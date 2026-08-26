// Reveal animation

const reveals=document.querySelectorAll('.reveal');

const observer=new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

entry.target.classList.add('active');

}

});

},{threshold:.2});

reveals.forEach(r=>observer.observe(r));


// Animated counters

const counters=document.querySelectorAll('[data-target]');

const speed=200;

const counterObserver=new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(!entry.isIntersecting) return;

const counter=entry.target;

const target=+counter.dataset.target;

const update=()=>{

const current=+counter.innerText;

const increment=Math.ceil(target/25);

if(current<target){

counter.innerText=current+increment;

requestAnimationFrame(update);

}else{

counter.innerText=target+"%";

}

};

update();

counterObserver.unobserve(counter);

});

});

counters.forEach(c=>counterObserver.observe(c));


// Custom cursor

const cursor=document.querySelector('.cursor');

window.addEventListener('mousemove',e=>{

cursor.style.left=e.clientX+'px';

cursor.style.top=e.clientY+'px';

});


// Navbar blur on scroll

const nav=document.querySelector('nav');

window.addEventListener('scroll',()=>{

nav.style.background=window.scrollY>50
? '#050505dd'
: '#00000070';

});
