/* global sb */
const ADMIN = (function(){
  let session = null;

  async function requireAuth(){
    const { data: { session: s } } = await sb.auth.getSession();
    session = s;
    renderAuthUI();
    if(!session) return false;
    return true;
  }

function renderAuthUI(){
  const authed = !!session;
  document.getElementById('authBox').style.display = authed ? 'none' : 'block';
  document.getElementById('adminBox').style.display = authed ? 'block' : 'none';
  document.querySelectorAll('.requires-auth').forEach(el => {
    el.style.display = authed ? '' : 'none';
  });
  const emailOut = document.getElementById('whoami');
  if(authed && emailOut){ sb.auth.getUser().then(({data})=>{ emailOut.textContent = data.user?.email || ''; }); }
}


  function bindAuth(){
    const signInForm = document.getElementById('signInForm');
    signInForm?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const email = e.target.email.value;
      const password = e.target.password.value;
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if(error){ alert(error.message + "\n(Henüz hesabın yoksa 'Sign up' ile oluştur ve emailini admins tablosuna ekle)"); return; }
      session = data.session; renderAuthUI(); await loadAll();
    });
    const signUpBtn = document.getElementById('signUpBtn');
    signUpBtn?.addEventListener('click', async ()=>{
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const { data, error } = await sb.auth.signUp({ email, password });
      if(error){ alert(error.message); return; }
      alert('Kayıt oluşturuldu. Bu hesaba yetki vermek için emaili admins tablosuna ekleyin.');
    });
    const signOutBtn = document.getElementById('signOutBtn');
    signOutBtn?.addEventListener('click', async ()=>{ await sb.auth.signOut(); session=null; renderAuthUI(); });
  }

  async function loadAll(){
    await Promise.all([renderCerts(), renderRestaurants(), renderPublicCertTable()]);
  }

  async function renderRestaurants(){
    const tbody = document.getElementById('adminRestTableBody');
    if(!tbody) return;
    const { data, error } = await sb.from('restaurants').select('id,name,address,cuisines,website,phone,coords').order('name');
    if(error){ tbody.innerHTML = `<tr><td colspan="5">Hata: ${error.message}</td></tr>`; return; }
    tbody.innerHTML = '';
    data.forEach((r, idx)=>{
      const lat = r.coords?.coordinates?.[1];
      const lng = r.coords?.coordinates?.[0];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.name||''}</td><td>${(lat&&lng)? lat.toFixed(4)+', '+lng.toFixed(4):''}</td>
        <td class="small muted">${r.address||''}</td>
        <td><button data-edit="${r.id}">Düzenle</button> <button data-del="${r.id}">Sil</button></td>`;
      tbody.appendChild(tr);
    });
  }

  async function renderCerts(){
    const tbody = document.getElementById('adminCertTableBody');
    if(!tbody) return;
    const { data, error } = await sb.from('cert_bodies').select('*').order('body');
    if(error){ tbody.innerHTML = `<tr><td colspan="5">Hata: ${error.message}</td></tr>`; return; }
    tbody.innerHTML='';
    data.forEach((c)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c.body||''}</td><td>${c.criteria||''}</td><td>${c.audit||''}</td><td>${c.reliability_score??''}</td>
        <td><button data-editc="${c.id}">Düzenle</button> <button data-delc="${c.id}">Sil</button></td>`;
      tbody.appendChild(tr);
    });
    updateCertBodiesDatalist(data);
  }

  async function renderPublicCertTable(){
    const certTbody = document.getElementById('certTable');
    if(!certTbody) return;
    const { data, error } = await sb.from('cert_bodies').select('*').order('body');
    if(error){ return; }
    certTbody.innerHTML = '';
    data.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c.body}</td><td>${c.criteria||''}</td><td>${c.audit||''}</td><td>${c.reliability_score??''}</td>`;
      certTbody.appendChild(tr);
    });
  }

  function updateCertBodiesDatalist(certs){
    const dl = document.getElementById('certBodiesList');
    if(!dl) return;
    dl.innerHTML = '';
    certs.forEach(c=>{ const o=document.createElement('option'); o.value = c.id; o.label = c.body; dl.appendChild(o); });
  }

  function bindTables(){
    // Restaurants actions
    document.getElementById('adminRestTable')?.addEventListener('click', async (e)=>{
      const t = e.target;
      if(!(t instanceof HTMLElement)) return;
      if(t.dataset.edit){ fillRestForm(t.dataset.edit); }
      if(t.dataset.del){ if(confirm('Silinsin mi?')){ const { error } = await sb.from('restaurants').delete().eq('id', t.dataset.del); if(error) alert(error.message); await loadAll(); } }
    });

    // Certs actions
    document.getElementById('adminCertTable')?.addEventListener('click', async (e)=>{
      const t = e.target; if(!(t instanceof HTMLElement)) return;
      if(t.dataset.editc){ fillCertForm(t.dataset.editc); }
      if(t.dataset.delc){ if(confirm('Silinsin mi?')){ const { error } = await sb.from('cert_bodies').delete().eq('id', t.dataset.delc); if(error) alert(error.message); await loadAll(); } }
    });
  }

  function bindForms(){
    // Restaurant form
    const restForm = document.getElementById('restForm');
    const cancelBtn = document.getElementById('restFormCancel');
    restForm?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(restForm);
      const id = fd.get('id') || null;
      const name = fd.get('name'); const address = fd.get('address'); const website = fd.get('website'); const phone = fd.get('phone');
      const lat = parseFloat(fd.get('lat')); const lng = parseFloat(fd.get('lng'));
      const cuisinesRaw = (fd.get('cuisines')||'').toString(); const cuisines = cuisinesRaw? cuisinesRaw.split(',').map(s=>s.trim()).filter(Boolean) : [];
      const bodyId = fd.get('body'); const status = fd.get('status'); const score = Number(fd.get('score')||0); const lastVerified = fd.get('lastVerified')||null;

      // Upsert restaurant
      let res;
      if(id){ res = await sb.from('restaurants').update({ name, address, website, phone, cuisines, coords: `SRID=4326;POINT(${lng} ${lat})` }).eq('id', id).select('id'); }
      else { res = await sb.from('restaurants').insert({ name, address, website, phone, cuisines, coords: `SRID=4326;POINT(${lng} ${lat})` }).select('id'); }
      if(res.error){ alert(res.error.message); return; }
      const rid = res.data[0].id;

      // Upsert certification (simple: one active cert per restaurant)
      // delete existing then insert new
      await sb.from('certifications').delete().eq('restaurant_id', rid);
      if(bodyId || status){
        const payload = { restaurant_id: rid, status };
        if(bodyId) payload.cert_body_id = bodyId;
        if(score) payload.score = score;
        if(lastVerified) payload.last_verified = lastVerified;
        const ins = await sb.from('certifications').insert(payload);
        if(ins.error){ alert(ins.error.message); }
      }

      cancelBtn?.click?.();
      restForm.reset();
      await loadAll();
      alert('Kaydedildi.');
    });

    window.fillRestForm = async function(id){
      // Fetch restaurant + its certification
      const { data: rds, error } = await sb.from('restaurants').select('id,name,address,website,phone,cuisines,coords').eq('id', id).single();
      if(error){ alert(error.message); return; }
      const { data: cds } = await sb.from('certifications').select('*').eq('restaurant_id', id).limit(1);
      const cert = (cds||[])[0];
      restForm.elements['id'].value = rds.id;
      restForm.elements['name'].value = rds.name||'';
      restForm.elements['address'].value = rds.address||'';
      const lat = rds.coords?.coordinates?.[1]; const lng = rds.coords?.coordinates?.[0];
      restForm.elements['lat'].value = lat||''; restForm.elements['lng'].value = lng||'';
      restForm.elements['cuisines'].value = (rds.cuisines||[]).join(', ');
      restForm.elements['status'].value = cert?.status||'unknown';
      restForm.elements['body'].value = cert?.cert_body_id||'';
      restForm.elements['score'].value = cert?.score||'';
      restForm.elements['lastVerified'].value = cert?.last_verified||'';
      restForm.elements['website'].value = rds.website||'';
      restForm.elements['phone'].value = rds.phone||'';
      location.hash = '#restForm';
    };

    // Cert form
    const certForm = document.getElementById('certForm');
    const certCancel = document.getElementById('certFormCancel');
    certForm?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(certForm);
      const id = fd.get('id') || null;
      const body = fd.get('body'); const criteria = fd.get('criteria'); const audit = fd.get('audit'); const reliability_score = Number(fd.get('score')||0);
      let res;
      if(id){ res = await sb.from('cert_bodies').update({ body, criteria, audit, reliability_score }).eq('id', id); }
      else { res = await sb.from('cert_bodies').insert({ body, criteria, audit, reliability_score }); }
      if(res.error){ alert(res.error.message); return; }
      certCancel?.click?.(); certForm.reset(); await loadAll(); alert('Kaydedildi.');
    });

    window.fillCertForm = async function(id){
      const { data: c, error } = await sb.from('cert_bodies').select('*').eq('id', id).single();
      if(error){ alert(error.message); return; }
      certForm.elements['id'].value = c.id;
      certForm.elements['body'].value = c.body||'';
      certForm.elements['criteria'].value = c.criteria||'';
      certForm.elements['audit'].value = c.audit||'';
      certForm.elements['score'].value = c.reliability_score||'';
      location.hash = '#certForm';
    };
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    bindAuth(); bindTables(); bindForms();
    if(await requireAuth()){ await loadAll(); }
  });
  return {};
})();
