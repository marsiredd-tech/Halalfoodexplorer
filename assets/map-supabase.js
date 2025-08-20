/* global L, sb */
const MAP = (function(){
  const state = {
    center: { lat: 52.5200, lng: 13.4050 }, // Berlin
    radiusKm: 5,
    sortBy: 'distance-asc',                 // YENİ: sıralama
    cluster: null,
    lastData: null,
    resultMarkers: []
  };

  // --- yardımcılar ---
  function colorFor(status){
    if(status==='certified') return '#27c93f';
    if(status==='self-declared') return '#f5b301';
    if(status==='not-halal') return '#ff5f56';
    return '#aab0bc';
  }
  function statusBadge(status, body){
    if(status === 'certified') return '<span class="badge b-ok">Sertifikalı' + (body? ' — '+body : '') + '</span>';
    if(status === 'self-declared') return '<span class="badge b-warn">İşletme beyanı</span>';
    if(status === 'not-halal') return '<span class="badge">Helal değil</span>';
    return '<span class="badge b-unk">Bilinmiyor</span>';
  }
  function fmtKm(k){ return (Math.round(k*10)/10).toFixed(1) + ' km'; }

  // YENİ: URL senkronizasyonu
  function syncFiltersToURL(){
    const p = new URLSearchParams();
    p.set('r', String(state.radiusKm));
    const only = document.getElementById('onlyCertified');
    if(only?.checked) p.set('cert','1');
    const body = document.getElementById('certBodyFilter')?.value; if(body) p.set('body', body);
    const cui  = document.getElementById('cuisineFilter')?.value;  if(cui)  p.set('cui', cui);
    const sort = document.getElementById('sortBy')?.value || state.sortBy; if(sort) p.set('sort', sort);
    history.replaceState(null, '', location.pathname + '?' + p.toString());
  }
  function loadFiltersFromURL(){
    const p = new URLSearchParams(location.search);
    const r = Number(p.get('r')); if(r) state.radiusKm = r;
    const only = p.get('cert')==='1';
    const onlyEl = document.getElementById('onlyCertified'); if(onlyEl) onlyEl.checked = only;
    const body = p.get('body');  const bodyEl = document.getElementById('certBodyFilter'); if(body && bodyEl) bodyEl.value = body;
    const cui  = p.get('cui');   const cuiEl  = document.getElementById('cuisineFilter'); if(cui && cuiEl) cuiEl.value = cui;
    const sort = p.get('sort');  const sortEl = document.getElementById('sortBy'); if(sortEl && sort){ sortEl.value = sort; state.sortBy = sort; }
    const radLabel = document.getElementById('radiusLabel'); const radInput = document.getElementById('radiusKm');
    if(radInput){ radInput.value = String(state.radiusKm); }
    if(radLabel){ radLabel.textContent = String(state.radiusKm); }
  }

  // YENİ: Cluster ikon (cluster varsa marker kullanacağız)
  function iconFor(status){
    const color = colorFor(status);
    return L.divIcon({
      className: 'hr-dot',
      html: `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 0 1px ${color}"></span>`,
      iconSize: [16,16],
      iconAnchor: [8,8]
    });
  }

  function bindUI(map){
    const radiusInput = document.getElementById('radiusKm');
    const radiusLabel = document.getElementById('radiusLabel');
    const onlyCertified = document.getElementById('onlyCertified');
    const btn = document.getElementById('btnFind');
    const openNow = document.getElementById('openNow'); // ileride kullanacağız
    const certBodyFilter = document.getElementById('certBodyFilter');
    const statusEl = document.getElementById('status');
    const cuisineFilter = document.getElementById('cuisineFilter');
    const sortBy = document.getElementById('sortBy');     // YENİ
    const addressInput = document.getElementById('addressInput'); // YENİ (opsiyonel)
    const btnGeocode = document.getElementById('btnGeocode');     // YENİ (opsiyonel)

    const listEl = document.getElementById('list');
    const statsEl = document.getElementById('resultStats');

    function drawRadius(center){
      if(state.radiusCircle) map.removeLayer(state.radiusCircle);
      state.radiusCircle = L.circle([center.lat, center.lng], {radius: state.radiusKm * 1000, color:'#4f8cff', weight:1, fillOpacity:.05}).addTo(map);
    }
    function clearMarkers(){
      if(state.cluster){ state.cluster.clearLayers(); }
      (state.resultMarkers||[]).forEach(m => map.removeLayer(m));
      state.resultMarkers = [];
    }

    async function renderList(center){
      clearMarkers();
      listEl.innerHTML = '';
      statsEl.textContent = 'Yükleniyor…';

      const { data, error } = await sb.rpc('nearby_restaurants', {
        lat: center.lat, lng: center.lng, radius_km: state.radiusKm, only_certified: !!document.getElementById('onlyCertified')?.checked
      });
      if(error){ statsEl.textContent = 'Hata: ' + error.message; return; }

      // Mevcut merkez+yarıçap için mutfak seçeneklerini güncelle
      try{ await refreshCuisineOptions(center); }catch(_){}

      // SIRALAMA (kopya üzerinde)
      let d = (data||[]).slice();
      if(state.sortBy === 'distance-asc'){
        d.sort((a,b)=> (a.distance_km??999) - (b.distance_km??999));
      }else if(state.sortBy === 'distance-desc'){
        d.sort((a,b)=> (b.distance_km??-1) - (a.distance_km??-1));
      }else if(state.sortBy === 'score-desc'){
        d.sort((a,b)=> (b.score??-1) - (a.score??-1));
      }else if(state.sortBy === 'name-asc'){
        d.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
      }
      state.lastData = d;

      const cuisineFilterEl = cuisineFilter;
      const bodyFilterEl = certBodyFilter;

      let rows = 0;
      (d||[]).forEach(r=>{
        // --- FİLTRELER ---
        if(cuisineFilterEl && cuisineFilterEl.value){
          const tags = (r.cuisines||[]).map(s=>s && s.toLowerCase());
          if(!tags.includes(cuisineFilterEl.value)) return;
        }
        if(bodyFilterEl && bodyFilterEl.value && r.cert_body && r.cert_body !== bodyFilterEl.value) return;
        // (openNow ileride eklenecek)
        // --- /FİLTRELER ---

        // Marker: cluster varsa L.marker, yoksa circleMarker
        let marker;
        if(state.cluster){
          marker = L.marker([r.lat, r.lng], { icon: iconFor(r.status) });
          state.cluster.addLayer(marker);
        }else{
          marker = L.circleMarker([r.lat, r.lng], { radius:8, weight:2, color:colorFor(r.status), fillOpacity:.25 }).addTo(map);
        }
        marker.bindPopup(`<strong>${r.name}</strong><br>${r.address||''}<br>${statusBadge(r.status, r.cert_body)}`);
        (state.resultMarkers||(state.resultMarkers=[])).push(marker);

        const item = document.createElement('div');
        item.className = 'item';
        item.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <div>
            <strong>${r.name}</strong><br>
            <span class="muted small">${r.address||''}</span>
            <div class="badges">
              ${statusBadge(r.status, r.cert_body)}
              ${r.score!=null? `<span class='badge'>Güvenilirlik: ${r.score}/100</span>`:''}
              ${r.cuisines?.length? `<span class='badge'>${r.cuisines.join(', ')}</span>`:''}
            </div>
          </div>
          <div title="Uzaklık">${fmtKm(r.distance_km)}</div>
        </div>`;
        item.addEventListener('click', ()=>{ map.setView([r.lat, r.lng], 15); marker.openPopup(); });
        listEl.appendChild(item);
        rows++;
      });

      statsEl.textContent = rows ? `${rows} sonuç bulundu.` : 'Sonuç bulunamadı.';
    }

    // --- Eventler ---
    cuisineFilter?.addEventListener('change', ()=>{
      if(state.center){ renderList(state.center); }
      syncFiltersToURL();
    });
    certBodyFilter?.addEventListener('change', ()=>{
      if(state.center){ renderList(state.center); }
      syncFiltersToURL();
    });
    sortBy?.addEventListener('change', ()=>{
      state.sortBy = sortBy.value || 'distance-asc';
      if(state.center){ renderList(state.center); }
      syncFiltersToURL();
    });

    radiusInput.addEventListener('input', ()=>{
      state.radiusKm = +radiusInput.value;
      radiusLabel.textContent = radiusInput.value;
      if(state.center){
        drawRadius(state.center);
        refreshCuisineOptions(state.center);
        renderList(state.center);
      }
      syncFiltersToURL();
    });

    onlyCertified.addEventListener('change', ()=>{
      if(state.center){ renderList(state.center); }
      syncFiltersToURL();
    });

    // Konumu bul
    btn.addEventListener('click', ()=>{
      statusEl.textContent = 'Konum alınıyor…';
      btn.disabled = true;
      if(!navigator.geolocation){ statusEl.textContent = 'Tarayıcınız konum özelliğini desteklemiyor.'; btn.disabled = false; return; }
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude:lat, longitude:lng } = pos.coords;
        state.center = { lat, lng };
        if(state.userMarker) map.removeLayer(state.userMarker);
        state.userMarker = L.marker([lat, lng]).addTo(map).bindPopup('Konumunuz');
        map.setView([lat, lng], 14);
        drawRadius(state.center);
        refreshCuisineOptions(state.center);
        renderList(state.center);
        syncFiltersToURL();
        statusEl.textContent = '';
        btn.disabled = false;
      }, err => {
        statusEl.textContent = 'Konum alınamadı: ' + (err.message || 'Bilinmeyen hata');
        btn.disabled = false;
      }, { enableHighAccuracy:true, timeout:10000, maximumAge:0 });
    });

    // YENİ: Adresle arama (opsiyonel; HTML'de alan yoksa çalışmaz)
    btnGeocode?.addEventListener('click', async ()=>{
      const q = (addressInput?.value||'').trim();
      if(!q){ alert('Lütfen bir adres/konum yazın.'); return; }
      try{
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}&accept-language=tr`;
        const resp = await fetch(url, { headers: { 'Accept': 'application/json' }});
        const arr = await resp.json();
        if(!arr.length){ alert('Adres bulunamadı.'); return; }
        const { lat, lon } = arr[0];
        state.center = { lat: Number(lat), lng: Number(lon) };
        if(state.userMarker) map.removeLayer(state.userMarker);
        state.userMarker = L.marker([state.center.lat, state.center.lng]).addTo(map).bindPopup('Seçilen konum');
        map.setView([state.center.lat, state.center.lng], 14);
        drawRadius(state.center);
        refreshCuisineOptions(state.center);
        renderList(state.center);
        syncFiltersToURL();
      }catch(e){
        alert('Adres aranırken hata oluştu.');
        console.error(e);
      }
    });

    // Dışarıdan da erişilsin diye:
    // window._renderList = renderList; // gerekirse aç
    // window._drawRadius = drawRadius;
  }

  async function refreshCuisineOptions(center){
    try{
      const sel = document.getElementById('cuisineFilter');
      if(!sel || !window.sb || !center) return;

      // RPC ile (tercih edilen): mevcut merkez + yarıçap
      let list = [];
      try{
        const { data, error } = await sb.rpc('list_cuisines_near', {
          lat: center.lat, lng: center.lng, radius_km: state.radiusKm
        });
        if(error) throw error;
        list = data || [];
      }catch(_){
        // Yedek: son çekilen sonuçlardan çıkar
        const tally = (state.lastData||[]).flatMap(r=>r.cuisines||[])
          .reduce((acc,t)=>{ t=(t||'').toLowerCase(); if(!t) return acc; acc[t]=(acc[t]||0)+1; return acc; },{});
        list = Object.entries(tally).map(([tag,cnt])=>({tag,cnt})).sort((a,b)=>b.cnt-a.cnt).slice(0,50);
      }

      const prev = sel.value;
      sel.innerHTML = '<option value="">Hepsi</option>';
      (list||[]).forEach(row=>{
        const tag = row.tag || row; // RPC veya fallback
        const o = document.createElement('option');
        o.value = (tag||'').toLowerCase();
        o.textContent = tag;
        sel.appendChild(o);
      });
      if(prev && Array.from(sel.options).some(o=>o.value===prev)){ sel.value = prev; }
    }catch(e){ console.warn('Cuisine options refresh failed', e); }
  }

  async function loadCertBodies(){
    try{
      const sel = document.getElementById('certBodyFilter');
      if(!sel || !window.sb) return;
      sel.innerHTML = '<option value="">Hepsi</option>';
      const { data, error } = await sb.from('cert_bodies').select('body').order('body');
      if(error) return;
      (data||[]).forEach(c=>{
        const o = document.createElement('option');
        o.value = c.body; o.textContent = c.body;
        sel.appendChild(o);
      });
    }catch(e){ console.warn('loadCertBodies failed', e); }
  }

  async function init(){
    if(!window.sb){ console.error('Supabase client yok. assets/env.js dosyasını doldurun.'); return; }
    const map = L.map('map', { zoomControl:true, attributionControl:true });
    map.setView([state.center.lat, state.center.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar'
    }).addTo(map);

    // YENİ: Marker cluster (kütüphane yüklüyse)
    if(typeof L.markerClusterGroup === 'function'){
      state.cluster = L.markerClusterGroup();
      map.addLayer(state.cluster);
    }

    bindUI(map);
    loadCertBodies();
    refreshCuisineOptions(state.center);
    loadFiltersFromURL();
    // İstersen başlangıçta listeyi Berlin için yükle:
    // drawRadius state.bindUI içinde, burada sadece listeyi dolduralım.
    const radiusLabel = document.getElementById('radiusLabel');
    if(radiusLabel) radiusLabel.textContent = String(state.radiusKm);
    const radiusInput = document.getElementById('radiusKm');
    if(radiusInput)  radiusInput.value = String(state.radiusKm);

    // Başlangıçta bir liste render edelim:
    if(state.center){ 
      // drawRadius sadece bindUI içinde vardı; geolocate/geocode/slider’da çiziliyor.
      const btn = document.getElementById('btnFind');
      if(!btn){ /* buton yoksa yine de deneyelim */ }
      // Sadece listeyi yükleyelim (daire, kullanıcı hareketiyle çizilecek)
      const fakeMapObj = map; // referans
      // renderList bindUI içinde tanımlı; dışarı açmak istersen bindUI sonunda window._renderList = renderList yapabilirsin.
    }
  }

  return { init };
})();
document.addEventListener('DOMContentLoaded', ()=>{ if(document.getElementById('map')) MAP.init(); });
