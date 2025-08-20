/* global sb */
document.addEventListener('DOMContentLoaded', async ()=>{
  const certTbody = document.getElementById('certTable');
  if(!certTbody || !sb) return;
  const { data, error } = await sb.from('cert_bodies').select('*').order('body');
  if(error){ console.warn(error); return; }
  certTbody.innerHTML = '';
  (data||[]).forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${c.body}</td><td>${c.criteria||''}</td><td>${c.audit||''}</td><td>${c.reliability_score??''}</td>`;
    certTbody.appendChild(tr);
  });
});
