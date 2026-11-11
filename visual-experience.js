/* ProjectBaluga interactive visual experience */
(function () {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = document.getElementById("pbGlobe");
  if (canvas) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (ctx) {
      const root = document.documentElement, points = [], count = 180;
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i=0;i<count;i++) {
        const y=1-(i/(count-1))*2, radius=Math.sqrt(1-y*y), theta=golden*i;
        points.push({x:Math.cos(theta)*radius,y,z:Math.sin(theta)*radius});
      }
      const routes=[[12,46],[46,88],[88,121],[121,158],[158,12],[32,104],[64,144],[20,170]];
      let width=0,height=0,dpr=1,rotation=0,tilt=-.12,dragging=false,lastX=0,lastY=0,velocity=0,frame=0,lastTime=0,visible=true;
      function resize(){
        const rect=canvas.getBoundingClientRect();
        width=Math.max(1,rect.width);height=Math.max(1,rect.height);dpr=Math.min(window.devicePixelRatio||1,1.5);
        canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();
      }
      function project(point,angle,tiltAngle,radius,cx,cy){
        const x=point.x*Math.cos(angle)-point.z*Math.sin(angle),z=point.x*Math.sin(angle)+point.z*Math.cos(angle);
        const y=point.y*Math.cos(tiltAngle)-z*Math.sin(tiltAngle),depth=point.y*Math.sin(tiltAngle)+z*Math.cos(tiltAngle);
        return {x:cx+x*radius,y:cy-y*radius,z:depth,visible:depth>-.08};
      }
      function draw(){
        ctx.clearRect(0,0,width,height);
        const light=root.getAttribute("data-theme")==="light",accent=light?"91,77,238":"151,137,255",teal=light?"11,171,147":"95,233,208";
        const radius=Math.min(width,height)*.365,cx=width*.5,cy=height*.5;
        const projected=points.map(p=>project(p,rotation,tilt,radius,cx,cy));
        const glow=ctx.createRadialGradient(cx,cy,radius*.2,cx,cy,radius*1.35);
        glow.addColorStop(0,"rgba("+accent+","+(light ? 0.09 : 0.13)+")");glow.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
        ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.strokeStyle="rgba("+accent+",.25)";ctx.lineWidth=1;ctx.stroke();
        for(let lat=-60;lat<=60;lat+=30){
          const r=Math.cos(lat*Math.PI/180)*radius,y=cy-Math.sin(lat*Math.PI/180)*radius;
          ctx.beginPath();ctx.ellipse(cx,y,r,r*.24,0,0,Math.PI*2);ctx.strokeStyle="rgba("+accent+",.15)";ctx.lineWidth=.75;ctx.stroke();
        }
        for(let lon=0;lon<180;lon+=30){
          ctx.beginPath();ctx.ellipse(cx,cy,radius*Math.abs(Math.cos(lon*Math.PI/180)),radius,0,0,Math.PI*2);
          ctx.strokeStyle="rgba("+accent+",.11)";ctx.lineWidth=.7;ctx.stroke();
        }
        for(let i=0;i<projected.length;i++){
          const a=projected[i];if(!a.visible)continue;
          for(let j=i+1;j<Math.min(i+8,projected.length);j++){
            const b=projected[j];if(!b.visible)continue;
            const dx=a.x-b.x,dy=a.y-b.y;
            if(dx*dx+dy*dy<radius*radius*.045){
              ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
              ctx.strokeStyle="rgba("+accent+","+( .06+(a.z+b.z)*.025)+")";ctx.lineWidth=.55;ctx.stroke();
            }
          }
        }
        routes.forEach((route,index)=>{
          const a=projected[route[0]],b=projected[route[1]];if(!a.visible||!b.visible)return;
          const mx=(a.x+b.x)/2,my=(a.y+b.y)/2-radius*(.13+(index%3)*.035);
          ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(mx,my,b.x,b.y);
          ctx.strokeStyle="rgba("+(index%2?teal:accent)+",.72)";ctx.lineWidth=1.15;ctx.stroke();
          const t=(rotation*.32+index*.137)%1,px=(1-t)*(1-t)*a.x+2*(1-t)*t*mx+t*t*b.x,py=(1-t)*(1-t)*a.y+2*(1-t)*t*my+t*t*b.y;
          ctx.beginPath();ctx.arc(px,py,2.1,0,Math.PI*2);ctx.fillStyle="rgba("+teal+",.95)";ctx.shadowBlur=9;ctx.shadowColor="rgba("+teal+",.8)";ctx.fill();ctx.shadowBlur=0;
        });
        projected.forEach((p,i)=>{
          if(!p.visible)return;const major=i%17===0;
          ctx.beginPath();ctx.arc(p.x,p.y,major?2.5:1,0,Math.PI*2);
          ctx.fillStyle=major?"rgba("+teal+",.95)":"rgba("+accent+","+( .2+(p.z+1)*.22)+")";
          if(major){ctx.shadowBlur=10;ctx.shadowColor="rgba("+teal+",.7)";}ctx.fill();ctx.shadowBlur=0;
        });
        ctx.beginPath();ctx.arc(cx-radius*.24,cy-radius*.32,3.2,0,Math.PI*2);
        ctx.fillStyle="rgba("+teal+",.9)";ctx.shadowBlur=18;ctx.shadowColor="rgba("+teal+",.8)";ctx.fill();ctx.shadowBlur=0;
      }
      function animate(time){
        if(!visible||reduceMotion.matches)return;
        if(!lastTime||time-lastTime>28){
          if(!dragging){rotation+=.0018+velocity;velocity*=.96;tilt+=(-.12-tilt)*.015;}
          draw();lastTime=time;
        }
        frame=requestAnimationFrame(animate);
      }
      function start(){if(frame||!visible||reduceMotion.matches)return;frame=requestAnimationFrame(animate);}
      function stop(){if(frame)cancelAnimationFrame(frame);frame=0;}
      canvas.addEventListener("pointerdown",event=>{
        if(event.pointerType==="mouse"&&event.button!==0)return;
        dragging=true;lastX=event.clientX;lastY=event.clientY;velocity=0;
        event.preventDefault();
        try{canvas.setPointerCapture(event.pointerId);}catch(_error){}
      });
      canvas.addEventListener("pointermove",event=>{
        if(!dragging)return;
        const dx=event.clientX-lastX,dy=event.clientY-lastY;
        rotation+=dx*.009;tilt=Math.max(-.72,Math.min(.72,tilt+dy*.009));velocity=dx*.00014;
        lastX=event.clientX;lastY=event.clientY;draw();
        event.preventDefault();
      });
      const endDrag=()=>{dragging=false;};
      canvas.addEventListener("pointerup",endDrag);
      canvas.addEventListener("pointercancel",endDrag);
      canvas.addEventListener("lostpointercapture",endDrag);
      canvas.addEventListener("keydown",event=>{
        if(event.key==="ArrowLeft"||event.key==="ArrowRight"){rotation+=event.key==="ArrowLeft"?-.16:.16;draw();event.preventDefault();}
      });
      if("IntersectionObserver" in window){
        const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else stop();},{threshold:.05});
        observer.observe(canvas);
      }
      window.addEventListener("resize",resize,{passive:true});
      document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();else start();});
      reduceMotion.addEventListener?.("change",()=>{if(reduceMotion.matches){stop();draw();}else start();});
      new MutationObserver(draw).observe(root,{attributes:true,attributeFilter:["data-theme"]});
      resize();start();
    }
  }
  const details={
    systems:{index:"01 / 04",title:"Business systems",text:"Organize everyday work in one place—from records and transactions to useful reports and clear workflows.",tags:["Operations","Records","Visibility"]},
    network:{index:"02 / 04",title:"Networks & connectivity",text:"Connect people, devices, and services with a network designed around access, reliability, and the way a business operates.",tags:["Connectivity","Access","Reliability"]},
    automation:{index:"03 / 04",title:"Software & automation",text:"Reduce repetitive steps and help existing tools work together through focused software, integrations, and practical automation.",tags:["Workflows","Integrations","Efficiency"]},
    infrastructure:{index:"04 / 04",title:"Server & infrastructure",text:"Plan the underlying environment for applications and shared resources, including hosting, storage, backups, and access controls.",tags:["Servers","Storage","Foundations"]}
  };
  const buttons=Array.from(document.querySelectorAll("[data-ecosystem]"));
  if(buttons.length){
    const index=document.getElementById("pbEcosystemIndex"),title=document.getElementById("pbEcosystemTitle"),text=document.getElementById("pbEcosystemText"),tags=document.getElementById("pbEcosystemTags");
    function select(key){
      const item=details[key];if(!item)return;
      buttons.forEach(button=>{const active=button.dataset.ecosystem===key;button.classList.toggle("is-active",active);button.setAttribute("aria-pressed",String(active));});
      index.textContent=item.index;title.textContent=item.title;text.textContent=item.text;
      tags.replaceChildren(...item.tags.map(tag=>{const span=document.createElement("span");span.textContent=tag;return span;}));
    }
    buttons.forEach(button=>button.addEventListener("click",()=>select(button.dataset.ecosystem)));
  }
})();