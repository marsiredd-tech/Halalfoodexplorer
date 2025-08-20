(function(){
  // Active nav link based on path
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.menu a').forEach(a => {
    const href = a.getAttribute('href');
    if(href === path) a.classList.add('active');
  });
})();
