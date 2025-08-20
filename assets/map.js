/* global L */
const MAP = (function(){
  const state = {
    restaurants: [],
    certBodies: [],
    center: { lat: 52.5200, lng: 13.4050 }, // Berlin
    radiusKm: 5
  };

  // Load data from localStorage or seed.json
  async function loadData(){
    try{
      const lsRest = localStorage.getItem('hr_restaurants');
      const lsCert = localStorage.getItem('hr_cert_bodies');
      if(lsRest && lsCert){
        state.restaurants = JSON.parse(lsRest);
        state.certBodies = JSON.parse(lsCert);
      } else {
        const resp = await fetch('data/seed.json');
        const data = await resp.json();
        state.restaurants = data.restaurants || [];
        state.certBodies = data.cert_bodies || [];
      }
    }catch(e){
      console.error('Veri yüklenemedi', e);
    }
  }

  function haversineKm(lat1, lon1, lat2, lon2){
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2-lat1);
    const dLon = toRad(lon2-lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function statusBadge(r){
    const s = r.halal?.status || 'unknown';
    if(s === 'certified') return '<span class="badge b-ok">Sertifikalı' + (r.halal.body? ' — '+r.halal.body : '') + '</span>';
    if(s === 'self-declared') return '<span class="badge b-warn">İşletme beyanı</span>';
    if(s === 'not-halal') return '<span class="badge">Helal değil</span>';
    return '<span class="badge b-unk">Bilinmiyor</span>';
  }

  function colorFor(r){
    const s = r.halal?.status || 'unknown';
    if(s==='certified') return '#27c93f';
    if(s==='self-declared') return '#f5b301';
    if(s==='not-halal') return '#ff5f56';
    return '#aab0bc';
  }

  function fmtKm(k){ return (Math.round(k*10)/10).toFixed(1) + ' km'; }

  function bindUI(map){
    const radiusInput = document.getElementById('radiusKm');
    const radiusLabel = document.getElementById('radiusLabel');
    const onlyCertified = document.getElementById('onlyCertified');
    const btn = document.getElementById('btnFind');
    const statusEl = document.getElementById('status');
    const listEl = document.getElementById('list');
    const statsEl = document.getElementById('resultStats');

    function drawRadius(center){
      if(state.radiusCircle) map.removeLayer(state.radiusCircle);
      state.radiusCircle = L.circle([center.lat, center.lng], {radius: state.radiusKm * 1000, color:'#4f8cff', weight:1, fillOpacity:.05}).addTo(map);
    }

    function clearMarkers(){
      (state.resultMarkers||[]).forEach(m => map.removeLayer(m));
      state.resultMarkers = [];
    }

    function renderList(center){
      clearMarkers();
      listEl.innerHTML = '';
      let rows = 0;
      state.restaurants.forEach(r=>{
        const d = haversineKm(center.lat, center.lng, r.coords.lat, r.coords.lng);
        if(d <= state.radiusKm && (!onlyCertified.checked || r.halal?.status === 'certified')){
          const marker = L.circleMarker([r.coords.lat, r.coords.lng], { radius:8, weight:2, color:colorFor(r), fillOpacity:.25 }).addTo(map);
          marker.bindPopup(`<strong>${r.name}</strong><br>${r.address}<br>${statusBadge(r)}`);
          state.resultMarkers.push(marker);

          const item = document.createElement('div');
          item.className = 'item';
          item.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
            <div>
              <strong>${r.name}</strong><br>
              <span class="muted small">${r.address}</span>
              <div class="badges">${statusBadge(r)} ${r.halal?.score? `<span class='badge'>Güvenilirlik: ${r.halal.score}/100</span>`:''} ${r.cuisines?.length? `<span class='badge'>${r.cuisines.join(', ')}</span>`:''}</div>
            </div>
            <div title="Uzaklık">${fmtKm(d)}</div>
          </div>`;
          item.addEventListener('click', ()=>{ map.setView([r.coords.lat, r.coords.lng], 15); marker.openPopup(); });
          listEl.appendChild(item);
          rows++;
        }
      });
      statsEl.textContent = rows ? `${rows} sonuç bulundu.` : 'Sonuç bulunamadı.';
    }

    radiusInput.addEventListener('input', ()=>{
      state.radiusKm = +radiusInput.value;
      radiusLabel.textContent = radiusInput.value;
      if(state.center){ drawRadius(state.center); renderList(state.center); }
    });
    onlyCertified.addEventListener('change', ()=>{ if(state.center){ renderList(state.center); }});

    btn.addEventListener('click', ()=>{
      statusEl.textContent = 'Konum alınıyor…';
      btn.disabled = true;
      if(!navigator.geolocation){
        statusEl.textContent = 'Tarayıcınız konum özelliğini desteklemiyor.';
        btn.disabled = false;
        return;
      }
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude:lat, longitude:lng } = pos.coords;
        state.center = { lat, lng };
        if(state.userMarker) map.removeLayer(state.userMarker);
        state.userMarker = L.marker([lat, lng]).addTo(map).bindPopup('Konumunuz');
        map.setView([lat, lng], 14);
        drawRadius(state.center);
        renderList(state.center);
        statusEl.textContent = '';
        btn.disabled = false;
      }, err => {
        statusEl.textContent = 'Konum alınamadı: ' + (err.message || 'Bilinmeyen hata');
        btn.disabled = false;
      }, { enableHighAccuracy:true, timeout:10000, maximumAge:0 });
    });
  }

  async function init(){
    await loadData();
    const map = L.map('map', { zoomControl:true, attributionControl:true });
    map.setView([state.center.lat, state.center.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar'
    }).addTo(map);
    bindUI(map);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', ()=>{
  if(document.getElementById('map')) MAP.init();
});
