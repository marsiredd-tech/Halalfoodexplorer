/* global sb */
const ADMIN = (function(){
  let session = null;

  // Sayfalama durumu
  const restPager = {
    page: 1,
    pageSize: 25,
    total: 0,
    search: ''
  };

  // ---- İstemci tarafı website normalizasyonu (sunucudaki trigger yine kalsın) ----
  function normalizeWeb(u){
    if(!u) return null;
    u = String(u).trim();
    if(!u) return null;
    // e-posta yanlışlıkla website alanına yazılmışsa null yap
    if(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(u)) return null;
    if(/^www\./i.test(u)) return 'https://' + u;
    if(!/^https?:\/\//i.test(u) && /^[A-Za-z0-9][A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#].*)?$/.test(u)){
      return 'https://' + u;
    }
    return u;
  }

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
    if(authed && emailOut){
      sb.auth.getUser().then(({data})=>{
        emailOut.textContent = data.user?.email || '';
      });
    }
  }

  function bindAuth(){
    const signInForm = document.getElementById('signInForm');
    signInForm?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const email = e.target.email.value;
      const password = e.target.password.value;
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if(error){
        alert(error.message + "\n(Henüz hesabın yoksa 'Sign up' ile oluştur ve emailini admins tablosuna ekle)");
        return;
      }
      session = data.session;
      renderAuthUI();
      await loadAll();
    });

    const signUpBtn = document.getElementById('signUpBtn');
    signUpBtn?.addEventListener('click', async ()=>{
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const { error } = await sb.auth.signUp({ email, password });
      if(error){ alert(error.message); return; }
      alert('Kayıt oluşturuldu. Bu hesaba yetki vermek için emaili admins tablosuna ekleyin.');
    });

    const signOutBtn = document.getElementById('signOutBtn');
    signOutBtn?.addEventListener('click', async ()=>{
      await sb.auth.signOut();
      session = null;
      renderAuthUI();
    });
  }

  async function loadAll(){
    await Promise.all([renderCerts(), renderRestaurants(), renderPublicCertTable()]);
  }

  // === Restoran listesi (arama + sayfalama) ===
  async function renderRestaurants(){
    const tbody = document.getElementById('adminRestTableBody');
    if(!tbody) return;

    const { page, pageSize, search } = restPager;
    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    let q = sb.from('restaurants')
      .select('id,name,address,cuisines,website,contact_email,phone,coords', { count: 'exact' })
      .order('name', { ascending: true });

    if(search && search.trim()){
      const term = `%${search.trim()}%`;
      // name OR address OR website OR contact_email içinde arama
      q = q.or(`name.ilike.${term},address.ilike.${term},website.ilike.${term},contact_email.ilike.${term}`);
    }

    const { data, error, count } = await q.range(from, to);

    if(error){
      tbody.innerHTML = `<tr><td colspan="4">Hata: ${error.message}</td></tr>`;
      updatePagerUI(0);
      return;
    }

    restPager.total = count || 0;
    tbody.innerHTML = '';

    (data||[]).forEach((r)=>{
      const lat = r.coords?.coordinates?.[1];
      const lng = r.coords?.coordinates?.[0];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.name||''}</td>
        <td>${(lat!=null && lng!=null)? lat.toFixed(4)+', '+lng.toFixed(4):''}</td>
        <td class="small muted">${r.address||''}</td>
        <td><button data-edit="${r.id}">Düzenle</button> <button data-del="${r.id}">Sil</button></td>`;
      tbody.appendChild(tr);
    });

    updatePagerUI(restPager.total, data?.length ?? 0, from, to);
  }

  function updatePagerUI(total=0, pageCount=0, from=0, to=0){
    const infoEl = document.getElementById('restPageInfo');
    const prevBtn = document.getElementById('restPrev');
    const nextBtn = document.getElementById('restNext');

    const shownTo = Math.min(total, to + 1);
    const shownFrom = total ? (from + 1) : 0;

    if(infoEl){
      infoEl.textContent = total
        ? `${shownFrom}–${shownTo} / ${total} — Sayfa ${restPager.page}`
        : `0 sonuç`;
    }

    if(prevBtn) prevBtn.disabled = restPager.page <= 1;
    const maxPage = Math.max(1, Math.ceil((total||0)/restPager.pageSize));
    if(nextBtn) nextBtn.disabled = restPager.page >= maxPage;
  }

  function bindPager(){
    const search = document.getElementById('restSearch');
    const pageSizeSel = document.getElementById('restPageSize');
    const prev = document.getElementById('restPrev');
    const next = document.getElementById('restNext');

    let t = null;
    search?.addEventListener('input', ()=>{
      clearTimeout(t);
      t = setTimeout(()=>{
        restPager.search = search.value || '';
        restPager.page = 1;
        renderRestaurants();
      }, 300);
    });

    pageSizeSel?.addEventListener('change', ()=>{
      restPager.pageSize = Number(pageSizeSel.value) || 25;
      restPager.page = 1;
      renderRestaurants();
    });

    prev?.addEventListener('click', ()=>{
      if(restPager.page > 1){
        restPager.page--;
        renderRestaurants();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    next?.addEventListener('click', ()=>{
      const maxPage = Math.max(1, Math.ceil((restPager.total||0)/restPager.pageSize));
      if(restPager.page < maxPage){
        restPager.page++;
        renderRestaurants();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // === Sertifika kurumları ===
  async function renderCerts(){
    const tbody = document.getElementById('adminCertTableBody');
    if(!tbody) return;
    const { data, error } = await sb.from('cert_bodies').select('*').order('body');
    if(error){
      tbody.innerHTML = `<tr><td colspan="5">Hata: ${error.message}</td></tr>`;
      return;
    }
    tbody.innerHTML='';
    (data||[]).forEach((c)=>{
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
    const { data } = await sb.from('cert_bodies').select('*').order('body');
    certTbody.innerHTML = '';
    (data||[]).forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c.body}</td><td>${c.criteria||''}</td><td>${c.audit||''}</td><td>${c.reliability_score??''}</td>`;
      certTbody.appendChild(tr);
    });
  }

  function updateCertBodiesDatalist(certs){
    const dl = document.getElementById('certBodiesList');
    if(!dl) return;
    dl.innerHTML = '';
    (certs||[]).forEach(c=>{
      const o=document.createElement('option');
      o.value = c.id;   // bodyId olarak kullanılacak
      o.label = c.body; // kullanıcı kurum adını görür
      dl.appendChild(o);
    });
  }

  function bindTables(){
    // Restaurants actions
    document.getElementById('adminRestTable')?.addEventListener('click', async (e)=>{
      const t = e.target;
      if(!(t instanceof HTMLElement)) return;
      if(t.dataset.edit){
        fillRestForm(t.dataset.edit);
      }
      if(t.dataset.del){
        if(confirm('Silinsin mi?')){
          const { error } = await sb.from('restaurants').delete().eq('id', t.dataset.del);
          if(error) alert(error.message);
          await renderRestaurants();
        }
      }
    });

    // Cert bodies actions
    document.getElementById('adminCertTable')?.addEventListener('click', async (e)=>{
      const t = e.target; if(!(t instanceof HTMLElement)) return;
      if(t.dataset.editc){ fillCertForm(t.dataset.editc); }
      if(t.dataset.delc){
        if(confirm('Silinsin mi?')){
          const { error } = await sb.from('cert_bodies').delete().eq('id', t.dataset.delc);
          if(error) alert(error.message);
          await renderCerts();
        }
      }
    });
  }

  function bindForms(){
    // Restaurant form
    const restForm = document.getElementById('restForm');
    const cancelBtn = document.getElementById('restFormCancel');

    restForm?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(restForm);

      // --- temel alanlar
      const id = fd.get('id') || null;
      const name = fd.get('name');
      const address = fd.get('address');
      const website = normalizeWeb(fd.get('website'));
      const phone = fd.get('phone');

      // e-posta (zorunlu değil ama format kontrolü yapalım)
      let contact_email = (fd.get('contact_email')||'').toString().trim().toLowerCase();
      if (contact_email && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(contact_email)) {
        alert('E-posta formatı geçersiz.');
        return;
      }

      const lat = parseFloat(fd.get('lat'));
      const lng = parseFloat(fd.get('lng'));
      if(!Number.isFinite(lat) || !Number.isFinite(lng)){
        alert('Geçerli Lat/Lng giriniz.');
        return;
      }

      const cuisinesRaw = (fd.get('cuisines')||'').toString();
      const cuisines = cuisinesRaw ? cuisinesRaw.split(',').map(s=>s.trim()).filter(Boolean) : [];

      // --- sertifika alanları
      const bodyId       = fd.get('body');
      const status       = fd.get('status');
      const score        = Number(fd.get('score')||0);
      const lastVerified = fd.get('lastVerified')||null;
      const certNumber   = fd.get('certNumber')||null;
      const validFrom    = fd.get('validFrom')||null;
      const validTo      = fd.get('validTo')||null;
      const certUrl      = fd.get('certUrl')||null;

      // --- çalışma saatleri (opsiyonel)
      const hoursRaw = fd.get('hours');
      let hours = null;
      if (hoursRaw && String(hoursRaw).trim()) {
        try { hours = JSON.parse(hoursRaw); }
        catch(e){ alert('Saatler JSON geçersiz: '+e.message); return; }
      }

      // Upsert restaurant
      let res;
      const payloadRest = {
        name, address, website, contact_email, phone, cuisines,
        coords: `SRID=4326;POINT(${lng} ${lat})`,
        hours
      };
      if(id){
        res = await sb.from('restaurants').update(payloadRest).eq('id', id).select('id');
      } else {
        res = await sb.from('restaurants').insert(payloadRest).select('id');
      }
      if(res.error){ alert(res.error.message); return; }
      const rid = res.data[0].id;

      // Upsert certification (simple: one active cert per restaurant)
      await sb.from('certifications').delete().eq('restaurant_id', rid);

      if (bodyId || status || certNumber || validFrom || validTo || certUrl || score || lastVerified) {
        const payload = { restaurant_id: rid, status };
        if (bodyId)        payload.cert_body_id   = bodyId;
        if (score)         payload.score          = score;
        if (lastVerified)  payload.last_verified  = lastVerified;
        if (certNumber)    payload.cert_number    = certNumber;
        if (validFrom)     payload.valid_from     = validFrom;
        if (validTo)       payload.valid_to       = validTo;
        if (certUrl)       payload.cert_url       = certUrl;

        const ins = await sb.from('certifications').insert(payload);
        if (ins.error) { alert(ins.error.message); }
      }

      // temizlik
      cancelBtn?.click?.();
      restForm.reset();
      await renderRestaurants();
      alert('Kaydedildi.');
    });

    // Formu düzenleme için doldur
    window.fillRestForm = async function(id){
      const { data: rds, error } = await sb
        .from('restaurants')
        .select('id,name,address,website,contact_email,phone,cuisines,coords,hours')
        .eq('id', id).single();
      if(error){ alert(error.message); return; }

      const { data: cds } = await sb
        .from('certifications')
        .select('*')
        .eq('restaurant_id', id)
        .limit(1);

      const cert = (cds||[])[0];

      const lat = rds.coords?.coordinates?.[1];
      const lng = rds.coords?.coordinates?.[0];

      const f = document.getElementById('restForm');

      f.elements['id'].value       = rds.id;
      f.elements['name'].value     = rds.name||'';
      f.elements['address'].value  = rds.address||'';
      f.elements['lat'].value      = lat ?? '';
      f.elements['lng'].value      = lng ?? '';
      f.elements['cuisines'].value = (rds.cuisines||[]).join(', ');
      f.elements['website'].value  = rds.website||'';
      f.elements['contact_email'].value = rds.contact_email||'';
      f.elements['phone'].value    = rds.phone||'';

      if (f.elements['hours']) {
        f.elements['hours'].value = rds.hours ? JSON.stringify(rds.hours) : '';
      }

      f.elements['status'].value       = cert?.status || 'unknown';
      f.elements['body'].value         = cert?.cert_body_id || '';
      f.elements['score'].value        = cert?.score || '';
      f.elements['lastVerified'].value = cert?.last_verified || '';
      f.elements['certNumber'].value   = cert?.cert_number || '';
      f.elements['validFrom'].value    = cert?.valid_from || '';
      f.elements['validTo'].value      = cert?.valid_to || '';
      f.elements['certUrl'].value      = cert?.cert_url || '';

      location.hash = '#restForm';
    };

    // Cert body form
    const certForm = document.getElementById('certForm');
    const certCancel = document.getElementById('certFormCancel');
    certForm?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(certForm);
      const id = fd.get('id') || null;
      const body = fd.get('body');
      const criteria = fd.get('criteria');
      const audit = fd.get('audit');
      const reliability_score = Number(fd.get('score')||0);

      let res;
      if(id){
        res = await sb.from('cert_bodies').update({ body, criteria, audit, reliability_score }).eq('id', id);
      } else {
        res = await sb.from('cert_bodies').insert({ body, criteria, audit, reliability_score });
      }
      if(res.error){ alert(res.error.message); return; }
      certCancel?.click?.();
      certForm.reset();
      await renderCerts();
      alert('Kaydedildi.');
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
    bindAuth(); bindTables(); bindForms(); bindPager();
    if(await requireAuth()){ await loadAll(); }
  });

  return {};
})();
