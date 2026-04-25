(function() {
  const c = document.createElement('canvas');
  c.width = 300; c.height = 300;
  c.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;opacity:0.03;pointer-events:none;z-index:9997;mix-blend-mode:screen;';
  const ctx = c.getContext('2d');
  function grain() {
    const img = ctx.createImageData(300, 300);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i+1] = img.data[i+2] = v;
      img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    requestAnimationFrame(grain);
  }
  grain();
  document.body.appendChild(c);
})();
