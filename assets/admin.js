const ADMIN = (function(){
  let RESTAURANTS = [];
  let CERT_BODIES = [];

  function load(){
    try{
      const rs = localStorage.getItem('hr_restaurants');
      const cs = localStorage.getItem('hr_cert_bodies');
      if(rs && cs){
        RESTAURANTS = JSON.parse(rs); CERT_BODIES = JSON.parse(cs);
      } else {
        // seed
        fetch('data/seed.json').then(r=>r.json()).then(data=>{
          RESTAURANTS = data.restaurants || [];
          CERT_BODIES = data.cert_bodies || [];
          renderAll();
        });
      }
    }catch(e){ console.error(e); }
  }

  function save(){
    localStorage.setItem('hr_restaurants', JSON.stringify(RESTAURANTS));
    localStorage.setItem('hr_cert_bodies', JSON.stringify(CERT_BODIES));
    renderAll();
  }

  function updateCertBodiesDatalist(){
    const dl = document.getElementById('certBodiesList');
    if(!dl) return;
    dl.innerHTML = '';
    CERT_BODIES.forEach(c=>{ const o=document.createElement('option'); o.value = c.body; dl.appendChild(o); });
  }

  function renderRestaurants(){
    const tbody = document.getElementById('adminRestTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    RESTAURANTS.forEach((r, idx)=>{
      const tr = document.createElement('tr');
      const coords = (r.coords? `${Number(r.coords.lat).toFixed(4)}, ${Number(r.coords.lng).toFixed(4)}`:''); 
      const cert = (r.halal?.status||'') + (r.halal?.body? ` / ${r.halal.body}` : '');
      tr.innerHTML = `<td>${r.name||''}</td><td>${coords}</td><td>${cert}</td><td>${r.halal?.score??''}</td>
        <td><button data-edit="${idx}">Düzenle</button> <button data-del="${idx}">Sil</button></td>`;
      tbody.appendChild(tr);
    });
  }

  function renderCerts(){
    const tbody = document.getElementById('adminCertTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    CERT_BODIES.forEach((c, idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c.body||''}</td><td>${c.criteria||''}</td><td>${c.audit||''}</td><td>${c.score??''}</td>
        <td><button data-editc="${idx}">Düzenle</button> <button data-delc="${idx}">Sil</button></td>`;
      tbody.appendChild(tr);
    });
  }

  function renderAll(){
    renderRestaurants(); renderCerts(); updateCertBodiesDatalist(); renderPublicCertTable();
  }

  function renderPublicCertTable(){
    const certTbody = document.getElementById('certTable');
    if(!certTbody) return;
    certTbody.innerHTML = '';
    CERT_BODIES.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c.body}</td><td>${c.criteria||''}</td><td>${c.audit||''}</td><td>${c.score??''}</td>`;
      certTbody.appendChild(tr);
    });
  }

  function bind(){
    // Restaurants table actions
    const adminRestTable = document.getElementById('adminRestTable');
    if(adminRestTable){
      adminRestTable.addEventListener('click', (e)=>{
        const t = e.target;
        if(!(t instanceof HTMLElement)) return;
        if(t.dataset.edit){ fillRestForm(Number(t.dataset.edit)); }
        if(t.dataset.del){ const i=Number(t.dataset.del); if(confirm('Silinsin mi?')){ RESTAURANTS.splice(i,1); save(); } }
      });
    }

    // Rest form
    const restForm = document.getElementById('restForm');
    let editingRestIndex = null;
    if(restForm){
      const cancelBtn = document.getElementById('restFormCancel');
      restForm.addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(restForm);
        const r = {
          id: fd.get('id') || ('id_'+Date.now()),
          name: fd.get('name')?.toString()||'',
          coords: { lat: parseFloat(fd.get('lat')), lng: parseFloat(fd.get('lng')) },
          address: fd.get('address')?.toString()||'',
          cuisines: (fd.get('cuisines')?.toString()||'').split(',').map(s=>s.trim()).filter(Boolean),
          halal: { status: fd.get('status')?.toString()||'unknown', body: fd.get('body')?.toString()||'', score: Number(fd.get('score')||0), lastVerified: fd.get('lastVerified')?.toString()||'' },
          website: fd.get('website')?.toString()||'',
          phone: fd.get('phone')?.toString()||''
        };
        if(editingRestIndex!==null){ RESTAURANTS[editingRestIndex] = r; } else { RESTAURANTS.push(r); }
        editingRestIndex = null;
        cancelBtn?.click?.();
        restForm.reset();
        save();
      });
      window.fillRestForm = function(i){
        const r = RESTAURANTS[i]; if(!r) return;
        restForm.elements['id'].value = r.id||'';
        restForm.elements['name'].value = r.name||'';
        restForm.elements['address'].value = r.address||'';
        restForm.elements['lat'].value = r.coords?.lat||'';
        restForm.elements['lng'].value = r.coords?.lng||'';
        restForm.elements['cuisines'].value = (r.cuisines||[]).join(', ');
        restForm.elements['status'].value = r.halal?.status||'unknown';
        restForm.elements['body'].value = r.halal?.body||'';
        restForm.elements['score'].value = r.halal?.score||'';
        restForm.elements['lastVerified'].value = r.halal?.lastVerified||'';
        restForm.elements['website'].value = r.website||'';
        restForm.elements['phone'].value = r.phone||'';
        editingRestIndex = i;
        location.hash = '#restForm';
      }
    }

    // Certs table actions
    const adminCertTable = document.getElementById('adminCertTable');
    if(adminCertTable){
      adminCertTable.addEventListener('click', (e)=>{
        const t = e.target; if(!(t instanceof HTMLElement)) return;
        if(t.dataset.editc){ fillCertForm(Number(t.dataset.editc)); }
        if(t.dataset.delc){ const i=Number(t.dataset.delc); if(confirm('Silinsin mi?')){ CERT_BODIES.splice(i,1); save(); } }
      });
    }

    // Cert form
    const certForm = document.getElementById('certForm');
    let editingCertIndex = null;
    if(certForm){
      const cancelBtn = document.getElementById('certFormCancel');
      certForm.addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(certForm);
        const c = { body: fd.get('body')?.toString()||'', criteria: fd.get('criteria')?.toString()||'', audit: fd.get('audit')?.toString()||'', score: Number(fd.get('score')||0) };
        if(editingCertIndex!==null){ CERT_BODIES[editingCertIndex] = c; } else { CERT_BODIES.push(c); }
        editingCertIndex = null;
        cancelBtn?.click?.();
        certForm.reset();
        save();
      });
      window.fillCertForm = function(i){
        const c = CERT_BODIES[i]; if(!c) return;
        certForm.elements['body'].value = c.body||'';
        certForm.elements['criteria'].value = c.criteria||'';
        certForm.elements['audit'].value = c.audit||'';
        certForm.elements['score'].value = c.score||'';
        editingCertIndex = i;
        location.hash = '#certForm';
      }
    }

    // Export/Import/Reset
    const btnExport = document.getElementById('btnExport');
    if(btnExport){ btnExport.addEventListener('click', ()=>{
      const data = { restaurants: RESTAURANTS, cert_bodies: CERT_BODIES };
      const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'helalrestoran-data.json'; a.click(); URL.revokeObjectURL(url);
    }); }
    const inputImport = document.getElementById('inputImport');
    if(inputImport){ inputImport.addEventListener('change', async (e)=>{
      const f = e.target.files?.[0]; if(!f) return;
      try{ const text = await f.text(); const obj = JSON.parse(text);
        if(obj.restaurants) RESTAURANTS = obj.restaurants;
        if(obj.cert_bodies) CERT_BODIES = obj.cert_bodies;
        save(); alert('İçe aktarıldı.');
      }catch(err){ alert('Geçersiz JSON: '+err.message); }
      e.target.value='';
    }); }
    const btnReset = document.getElementById('btnReset');
    if(btnReset){ btnReset.addEventListener('click', ()=>{
      if(confirm('Demo verisine sıfırlansın mı?')){
        fetch('data/seed.json').then(r=>r.json()).then(d=>{
          RESTAURANTS = d.restaurants||[]; CERT_BODIES = d.cert_bodies||[]; save();
        });
      }
    }); }
  }

  document.addEventListener('DOMContentLoaded', ()=>{ load(); bind(); renderAll(); });
  return {};
})();
