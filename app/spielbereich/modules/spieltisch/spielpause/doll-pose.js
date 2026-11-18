const ease = t => t*t*(3-2*t);
const span = (t,a,b) => Math.max(0,Math.min(1,(t-a)/(b-a)));

/** Angles and translations of a solid doll, pivoting at its feet (metres). */
export function dollPose(progress = 1) {
  const t = Math.max(0,Math.min(1,progress));
  if(t < .34){
    const p=t/.34;
    return {x:-Math.PI/2*ease(p),y:.72+2.4*(1-p*p),z:0,squash:0};
  }
  if(t < .57){
    const p=span(t,.34,.57),bounce=Math.sin(p*Math.PI*3)*Math.exp(-p*5);
    return {x:-Math.PI/2+bounce*.06,y:.72+Math.max(0,bounce)*.16,z:0,squash:Math.abs(bounce)*.10};
  }
  const p=ease(span(t,.57,1));
  return {x:-Math.PI/2*(1-p)||0,y:.72*(1-p),z:0,squash:0};
}

export const DOLL_ENTRANCE_SECONDS = 3.6;
