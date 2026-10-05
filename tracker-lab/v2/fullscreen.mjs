const viewport=document.getElementById('viewport'),button=document.getElementById('fullscreen');
const active=()=>document.fullscreenElement===viewport||viewport.classList.contains('fullscreen-fallback');
function sync(){const on=active();button.setAttribute('aria-pressed',String(on));button.title=on?'Выйти из полного экрана (Esc)':'На весь экран';button.setAttribute('aria-label',button.title);button.textContent=on?'×':'⛶';}
function fallback(on){viewport.classList.toggle('fullscreen-fallback',on);document.body.classList.toggle('fullscreen-lock',on);sync();}
button.addEventListener('click',async()=>{
 if(document.fullscreenElement===viewport){await document.exitFullscreen();return;}
 if(viewport.classList.contains('fullscreen-fallback')){fallback(false);return;}
 if(viewport.requestFullscreen){try{await viewport.requestFullscreen();return;}catch{}}
 fallback(true);
});
document.addEventListener('fullscreenchange',sync);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&viewport.classList.contains('fullscreen-fallback'))fallback(false);});
// Fill the browser window immediately; native fullscreen needs a user gesture.
fallback(true);
