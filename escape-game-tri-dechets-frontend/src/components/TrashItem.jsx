import { useRef, useState } from 'react';
import plasticImg from '../assets/plastic.svg';
import cardboardImg from '../assets/cardboard.svg';
import glassImg from '../assets/glass.svg';
import organicImg from '../assets/organic.svg';

const typeToImg = {
  plastic: plasticImg,
  cardboard: cardboardImg,
  paper: cardboardImg,
  glass: glassImg,
  organic: organicImg,
};

export default function TrashItem({ item }) {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);

  const onDragStart = (e) => {
    setDragging(true);
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
    // ghost image tweak for nicer visuals
    if (ref.current) {
      const crt = ref.current.cloneNode(true);
      crt.style.position = 'absolute';
      crt.style.top = '-9999px';
      crt.style.transform = 'scale(1.1)';
      document.body.appendChild(crt);
      e.dataTransfer.setDragImage(crt, 20, 20);
      setTimeout(() => document.body.removeChild(crt), 0);
    }
  };

  const onDragEnd = () => setDragging(false);

  const imgSrc = typeToImg[item.type];

  return (
    <div
      ref={ref}
      className={`trash-item ${dragging ? 'dragging' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={item.label}
    >
      <img className="thumb" src={imgSrc} alt={item.label} />
      <span className="label">{item.label}</span>
    </div>
  );
}


