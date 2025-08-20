(function(){
  // Active nav link based on path
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.menu a').forEach(a => {
    const href = a.getAttribute('href');
    if(href === path) a.classList.add('active');
  });
})();
document.addEventListener('DOMContentLoaded', ()=>{
  const btn  = document.getElementById('menuToggle');
  const menu = document.getElementById('siteMenu');
  if(btn && menu){
    btn.addEventListener('click', ()=>{
      const open = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('menu-open', open);
    });
    // Menüden bir linke tıklanınca kapat
    menu.addEventListener('click', (e)=>{
      if(e.target.closest('a')){ menu.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }
    });
  }
});
