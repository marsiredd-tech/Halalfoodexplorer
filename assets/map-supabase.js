/* global L, sb */
const MAP = (function(){
  const state = {
    center: { lat: 52.5200, lng: 13.4050 }, // Berlin
    radiusKm: 5
  };

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

  function bindUI(map){
    const radiusInput = document.getElementById('radiusKm');
    const radiusLabel = document.getElementById('radiusLabel');
    const onlyCertified = document.getElementById('onlyCertified');
    const btn = document.getElementById('btnFind');
const openNow = document.getElementById('openNow');
const certBodyFilter = document.getElementById('certBodyFilter');
    const statusEl = document.getElementById('status');
    const cuisineFilter = document.getElementById('cuisineFilter');
cuisineFilter?.addEventListener('change', ()=>{ if(state.center){ renderList(state.center); }});
certBodyFilter?.addEventListener('change', ()=>{ if(state.center){ renderList(state.center); }});
    const listEl = document.getElementById('list');
    const statsEl = document.getElementById('resultStats');

    function drawRadius(center){
      if(state.radiusCircle) map.removeLayer(state.radiusCircle);
      state.radiusCircle = L.circle([center.lat, center.lng], {radius: state.radiusKm * 1000, color:'#4f8cff', weight:1, fillOpacity:.05}).addTo(map);
    }
    function clearMarkers(){ (state.resultMarkers||[]).forEach(m => map.removeLayer(m)); state.resultMarkers = []; }

async function renderList(center){
  clearMarkers();
  listEl.innerHTML = '';
  statsEl.textContent = 'Yükleniyor…';

  const { data, error } = await sb.rpc('nearby_restaurants', {
    lat: center.lat, lng: center.lng, radius_km: state.radiusKm, only_certified: onlyCertified.checked
  });
  if(error){ statsEl.textContent = 'Hata: ' + error.message; return; }

  // Mutfak seçeneklerini güncel tut (mevcut merkez+yarıçap için)
  try{ await refreshCuisineOptions(center); }catch(_) {}

  // Fallback için elde tut
  state.lastData = data;

  let rows = 0;
  (data||[]).forEach(r=>{
    // --- FİLTRELER ---
    // 1) Mutfak (tek seçim)
    if(cuisineFilter && cuisineFilter.value){
      const tags = (r.cuisines||[]).map(s=>s && s.toLowerCase());
      if(!tags.includes(cuisineFilter.value)) return;
    }
    // 2) Kurum (opsiyonel)
    if(certBodyFilter && certBodyFilter.value && r.cert_body && r.cert_body !== certBodyFilter.value) return;
    // --- /FİLTRELER ---

    const marker = L.circleMarker([r.lat, r.lng], { radius:8, weight:2, color:colorFor(r.status), fillOpacity:.25 }).addTo(map);
    marker.bindPopup(`<strong>${r.name}</strong><br>${r.address}<br>${statusBadge(r.status, r.cert_body)}`);
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

    radiusInput.addEventListener('input', ()=>{
      state.radiusKm = +radiusInput.value;
      radiusLabel.textContent = radiusInput.value;
      if(state.center){drawRadius(state.center);
    refreshCuisineOptions(state.center);   // YENİ
    renderList(state.center);
  }
    });
    onlyCertified.addEventListener('change', ()=>{ if(state.center){ renderList(state.center); }});

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
        renderList(state.center);
        refreshCuisineOptions(state.center);
        statusEl.textContent = '';
        btn.disabled = false;
      }, err => { statusEl.textContent = 'Konum alınamadı: ' + (err.message || 'Bilinmeyen hata'); btn.disabled = false; }, { enableHighAccuracy:true, timeout:10000, maximumAge:0 });
    });
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
    sel.innerHTML = '<option value=\"\">Hepsi</option>';
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
    // Hepsi harici seçenekleri sıfırla
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
    bindUI(map);
    loadCertBodies();              // <-- ekle
refreshCuisineOptions(state.center); // ilk yüklemede mutfakları da doldur
  }
  return { init };
})();
document.addEventListener('DOMContentLoaded', ()=>{ if(document.getElementById('map')) MAP.init(); });
