import { useState, useRef, useCallback } from "react";

const GAP = 6;
const S = 1080;

function makeGrid(cols, rows) {
  const cw = (S - GAP * (cols + 1)) / cols;
  const rh = (S - GAP * (rows + 1)) / rows;
  const slots = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      slots.push({ x: GAP + c*(cw+GAP), y: GAP + r*(rh+GAP), w: cw, h: rh });
  return slots;
}

function makeTShape() {
  const cell = (S - GAP*3) / 2;
  const topH = S - GAP*3 - cell;
  return [
    { x: GAP, y: GAP, w: S-GAP*2, h: topH },
    { x: GAP, y: GAP+topH+GAP, w: cell, h: cell },
    { x: GAP+cell+GAP, y: GAP+topH+GAP, w: cell, h: cell },
  ];
}

// 2:1 horizontal split (top=2/3, bottom=1/3)
function makeH21() {
  const total = S - GAP*3;
  const topH = Math.round(total * 2/3);
  const botH = total - topH;
  const w = S - GAP*2;
  return [
    { x: GAP, y: GAP, w, h: topH },
    { x: GAP, y: GAP+topH+GAP, w, h: botH },
  ];
}


// 上に正方形2つ、下に横長1つ（逆T字）
function makeInvTShape() {
  const cell = (S - GAP*3) / 2;
  const botH = S - GAP*3 - cell;
  return [
    { x: GAP,        y: GAP,        w: cell, h: cell },
    { x: GAP+cell+GAP, y: GAP,      w: cell, h: cell },
    { x: GAP, y: GAP+cell+GAP, w: S-GAP*2, h: botH },
  ];
}

// 左に正方形2つ（縦並び）、右に縦3分割
function makeL2R3() {
  const totalW = S - GAP*2;
  // left col: 2 squares stacked → each square side = (S - GAP*3)/2
  const cell = (S - GAP*3) / 2;
  const leftW = cell;
  const rightW = totalW - leftW - GAP;
  const rightH = (S - GAP*4) / 3;
  return [
    // left col
    { x: GAP,           y: GAP,            w: leftW, h: cell },
    { x: GAP,           y: GAP+cell+GAP,   w: leftW, h: cell },
    // right col x3
    { x: GAP+leftW+GAP, y: GAP,                      w: rightW, h: rightH },
    { x: GAP+leftW+GAP, y: GAP+rightH+GAP,           w: rightW, h: rightH },
    { x: GAP+leftW+GAP, y: GAP+(rightH+GAP)*2,       w: rightW, h: rightH },
  ];
}

// 上に正方形2つ、下に3分割
function makeT2B3() {
  const cell = (S - GAP*3) / 2;       // top square side
  const topH = cell;
  const botH = S - GAP*3 - topH;      // bottom row height
  const botW = (S - GAP*4) / 3;
  return [
    // top 2 squares
    { x: GAP,        y: GAP, w: cell, h: topH },
    { x: GAP+cell+GAP, y: GAP, w: cell, h: topH },
    // bottom 3
    { x: GAP,                y: GAP+topH+GAP, w: botW, h: botH },
    { x: GAP+botW+GAP,       y: GAP+topH+GAP, w: botW, h: botH },
    { x: GAP+(botW+GAP)*2,   y: GAP+topH+GAP, w: botW, h: botH },
  ];
}


// 左に縦長長方形、右に正方形2つ（縦並び）
function makeL1R2() {
  const cell = (S - GAP*3) / 2;
  const leftW = S - GAP*3 - cell;
  return [
    { x: GAP, y: GAP, w: leftW, h: S-GAP*2 },
    { x: GAP+leftW+GAP, y: GAP,          w: cell, h: cell },
    { x: GAP+leftW+GAP, y: GAP+cell+GAP, w: cell, h: cell },
  ];
}

const TEMPLATES = [
  { id: "v2",   label: "縦2分割",        slots: makeGrid(2,1) },
  { id: "h2",   label: "横2分割（1:1）", slots: makeGrid(1,2) },
  { id: "h21",  label: "横2分割（2:1）", slots: makeH21() },
  { id: "h3",   label: "横3分割",        slots: makeGrid(1,3) },
  { id: "v3",   label: "縦3分割",        slots: makeGrid(3,1) },
  { id: "t3",   label: "上横長＋下2",    slots: makeTShape() },
  { id: "g4",   label: "4分割",          slots: makeGrid(2,2) },
  { id: "g6",   label: "6分割",          slots: makeGrid(3,2) },
  { id: "invt3", label: "上2＋下横長",    slots: makeInvTShape() },
  { id: "l2r3",  label: "左2＋右3",       slots: makeL2R3() },
  { id: "t2b3",  label: "上2＋下3",       slots: makeT2B3() },
  { id: "l1r2",  label: "左縦長＋右2",    slots: makeL1R2() },
];

// Draw image onto canvas slot — mirrors CSS objectFit:cover + scale + objectPosition
function drawSlot(ctx, sd, slot) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.beginPath(); ctx.rect(sd.x, sd.y, sd.w, sd.h); ctx.clip();

      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const slotRatio = sd.w / sd.h;
      const imgRatio  = iw / ih;

      // CSS: width=zoom*100%, height=zoom*100%, top=(1-zoom)*50+offsetY %, left=(1-zoom)*50+offsetX %
      // Image element box:
      const boxW = sd.w * slot.zoom;
      const boxH = sd.h * slot.zoom;
      const boxX = sd.x + sd.w * ((1 - slot.zoom) * 50 + slot.offsetX) / 100;
      const boxY = sd.y + sd.h * ((1 - slot.zoom) * 50 + slot.offsetY) / 100;
      const boxRatio = boxW / boxH;
      let dw, dh;
      if (imgRatio > boxRatio) {
        dh = boxH; dw = dh * imgRatio;
      } else {
        dw = boxW; dh = dw / imgRatio;
      }
      const dx = boxX + (boxW - dw) / 2;
      const dy = boxY + (boxH - dh) / 2;

      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
      resolve();
    };
    img.onerror = resolve;
    img.src = slot.src;
  });
}

function SlotCell({ slotDef, slot, slotIndex, templateId, selectedImg, onSlotTap, onOpenControls, isAdjusting }) {
  const isSelecting = !!selectedImg;

  const handleTap = () => {
    if (isSelecting) {
      onSlotTap(templateId, slotIndex, selectedImg);
    } else if (slot) {
      onOpenControls({ templateId, slotIndex, slotDef });
    }
  };

  return (
    <div
      onClick={handleTap}
      style={{
        position: "absolute",
        left: `${(slotDef.x/S)*100}%`, top: `${(slotDef.y/S)*100}%`,
        width: `${(slotDef.w/S)*100}%`, height: `${(slotDef.h/S)*100}%`,
        background: isSelecting ? "#dbeafe" : slot ? "transparent" : "#f1f5f9",
        border: isSelecting ? "2.5px dashed #3b82f6" : slot ? "2px solid transparent" : "2px dashed #cbd5e1",
        borderRadius: 3, overflow: "visible", cursor: "pointer",
        boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {slot ? (
        <>
          <img src={slot.src} alt="" style={{
            position: "absolute",
            width: `${slot.zoom * 100}%`,
            height: `${slot.zoom * 100}%`,
            objectFit: "cover",
            top: `${(1 - slot.zoom) * 50 + slot.offsetY}%`,
            left: `${(1 - slot.zoom) * 50 + slot.offsetX}%`,
            pointerEvents: "none",
          }} />
          {isSelecting ? (
            <div style={{ position:"absolute",inset:0, background:"rgba(59,130,246,0.4)",
              display:"flex",alignItems:"center",justifyContent:"center" }}>
              <span style={{ color:"#fff",fontWeight:800,fontSize:10 }}>入れ替え</span>
            </div>
          ) : (
            <div style={{ position:"absolute",bottom:4,right:4,
              background:"rgba(0,0,0,0.5)", borderRadius:4, padding:"2px 5px" }}>
              <span style={{ color:"#fff",fontSize:9 }}>✏️ 調整</span>
            </div>
          )}
        </>
      ) : (
        <span style={{ color: isSelecting?"#2563eb":"#94a3b8", fontSize:9,
          textAlign:"center", lineHeight:1.4, fontWeight: isSelecting?700:400, padding:2 }}>
          {isSelecting ? "ここに配置" : "タップ"}
        </span>
      )}
    </div>
  );
}

function TemplateCard({ tmpl, slotValues, selectedImg, onSlotTap, onOpenControls, controlTarget, onAdjust, onRemove, onSave, onClear }) {
  const allFilled = slotValues.every(s => s !== null);
  const anyFilled = slotValues.some(s => s !== null);
  return (
    <div style={{ background:"#fff", borderRadius:12, boxShadow:"0 2px 10px #0001",
      padding:10, display:"flex", flexDirection:"column", gap:8,
      minWidth:150, maxWidth:175, flex:"0 0 auto" }}>
      <div style={{ fontWeight:700, fontSize:11, color:"#334155", textAlign:"center", lineHeight:1.3 }}>
        {tmpl.label}
      </div>
      <div style={{ width:"100%", paddingBottom:"100%", position:"relative", overflow:"visible" }}>
        <div style={{ position:"absolute", inset:0, background:"#e2e8f0", borderRadius:6, overflow:"visible" }}>
          {tmpl.slots.map((sd, i) => (
            <SlotCell key={i} slotDef={sd} slot={slotValues[i]} slotIndex={i}
              templateId={tmpl.id} selectedImg={selectedImg}
              onSlotTap={onSlotTap} onOpenControls={onOpenControls}
              isAdjusting={false} />
          ))}
        </div>
      </div>
      <button onClick={() => onSave(tmpl)} disabled={!allFilled}
        style={{ background: allFilled?"#6366f1":"#e2e8f0",
          color: allFilled?"#fff":"#94a3b8",
          border:"none", borderRadius:7, padding:"7px 0",
          fontWeight:700, fontSize:13,
          cursor: allFilled?"pointer":"not-allowed" }}>
        📤 保存してクリア
      </button>
      {anyFilled && (
        <button onClick={() => onClear(tmpl.id)}
          style={{ background:"#fee2e2", color:"#ef4444",
            border:"none", borderRadius:7, padding:"5px 0",
            fontWeight:700, fontSize:12, cursor:"pointer" }}>
          🗑 一括削除
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [images, setImages] = useState([]);
  const [slots, setSlots] = useState(() => {
    const s = {};
    TEMPLATES.forEach(t => { s[t.id] = Array(t.slots.length).fill(null); });
    return s;
  });
  const [selectedImg, setSelectedImg] = useState(null);
  const [saving, setSaving] = useState(null);
  const [previewDataUrl, setPreviewDataUrl] = useState(null);
  const [controlTarget, setControlTarget] = useState(null); // {templateId, slotIndex}
  const fileInputRef = useRef();
  const hiddenCanvas = useRef();

  const handleFiles = (files) => {
    Array.from(files).filter(f => f.type.startsWith("image/")).forEach(f => {
      const reader = new FileReader();
      reader.onload = e => {
        setImages(prev => prev.length >= 20 ? prev : [...prev, { src: e.target.result }]);
      };
      reader.readAsDataURL(f);
    });
  };

  const handleTrayTap = (img) => {
    setSelectedImg(prev => prev?.src === img.src ? null : img);
  };

  const handleSlotTap = useCallback((templateId, slotIndex, img) => {
    setSlots(prev => {
      const next = { ...prev, [templateId]: [...prev[templateId]] };
      next[templateId][slotIndex] = { src: img.src, zoom: 1, offsetX: 0, offsetY: 0 };
      return next;
    });
    setSelectedImg(null);
  }, []);

  const handleAdjust = useCallback((templateId, slotIndex, key, value) => {
    setSlots(prev => {
      const next = { ...prev, [templateId]: [...prev[templateId]] };
      next[templateId][slotIndex] = { ...next[templateId][slotIndex], [key]: value };
      return next;
    });
  }, []);

  const handleRemove = useCallback((templateId, slotIndex) => {
    setSlots(prev => {
      const next = { ...prev, [templateId]: [...prev[templateId]] };
      next[templateId][slotIndex] = null;
      return next;
    });
  }, []);

  const handleClear = useCallback((templateId) => {
    setSlots(prev => {
      const next = { ...prev };
      next[templateId] = Array(next[templateId].length).fill(null);
      return next;
    });
    setControlTarget(null);
  }, []);

  const handleSave = useCallback(async (tmpl) => {
    setSaving(tmpl.id);
    try {
      const canvas = hiddenCanvas.current;
      const ctx = canvas.getContext("2d");
      canvas.width = S; canvas.height = S;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, S, S);
      const slotValues = slots[tmpl.id];
      for (let i = 0; i < tmpl.slots.length; i++) {
        const slot = slotValues[i];
        if (slot) await drawSlot(ctx, tmpl.slots[i], slot);
      }
      const out = document.createElement("canvas");
      out.width = 800; out.height = 800;
      out.getContext("2d").drawImage(canvas, 0, 0, 800, 800);
      const dataUrl = out.toDataURL("image/jpeg", 0.88);
      setPreviewDataUrl(dataUrl);
      // Auto-clear template after save
      setSlots(prev => {
        const next = { ...prev };
        next[tmpl.id] = Array(next[tmpl.id].length).fill(null);
        return next;
      });
      setControlTarget(null);
    } catch(e) {
      alert("エラー: " + e.message);
    }
    setSaving(null);
  }, [slots]);

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4ff", fontFamily:"'Helvetica Neue',Arial,sans-serif" }}
      onClick={() => selectedImg && setSelectedImg(null)}>
      <canvas ref={hiddenCanvas} style={{ display:"none" }} />

      {/* Header */}
      <div style={{ background:"linear-gradient(90deg,#6366f1,#8b5cf6)", padding:"14px 20px", color:"#fff" }}>
        <div style={{ fontWeight:800, fontSize:18 }}>📦 メルカリ 分割画像メーカー</div>
        <div style={{ fontSize:12, opacity:0.85, marginTop:2 }}>写真をタップ選択 → スロットをタップで配置</div>
      </div>

      {/* Save preview modal */}
      {previewDataUrl && (
        <div onClick={() => setPreviewDataUrl(null)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)",
            zIndex:1000, display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", padding:16 }}>
          <p style={{ color:"#fff", fontSize:16, fontWeight:700, marginBottom:12, textAlign:"center" }}>
            📥 画像を長押し →「写真に保存」
          </p>
          <img src={previewDataUrl} alt="保存用画像"
            style={{ maxWidth:"100%", maxHeight:"70vh", borderRadius:8, display:"block" }}
            onClick={e => e.stopPropagation()} />
          <button onClick={() => setPreviewDataUrl(null)}
            style={{ marginTop:20, background:"#6366f1", color:"#fff", border:"none",
              borderRadius:10, padding:"12px 32px", fontSize:16, fontWeight:700, cursor:"pointer" }}>
            閉じる
          </button>
        </div>
      )}

      {/* Adjust panel — fixed bottom sheet */}
      {controlTarget && (() => {
        const { templateId, slotIndex } = controlTarget;
        const slot = slots[templateId]?.[slotIndex];
        if (!slot) return null;
        return (
          <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:500,
            background:"#1e1b4b", borderRadius:"18px 18px 0 0",
            padding:"16px 20px 32px", boxShadow:"0 -4px 24px rgba(0,0,0,0.4)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ color:"#fff", fontWeight:800, fontSize:15 }}>🎛 画像を調整</span>
              <button onClick={() => setControlTarget(null)}
                style={{ background:"#6366f1",color:"#fff",border:"none",borderRadius:8,
                  padding:"6px 16px",fontSize:14,fontWeight:700,cursor:"pointer" }}>✓ 完了</button>
            </div>
            {(() => {
              const sd = controlTarget.slotDef;
              const ratio = sd ? sd.w / sd.h : 1;
              // Outer: shows the "frame" (what will be cropped)
              // Inner: image moves freely so user can see the full image and choose crop
              return (
                <div style={{ marginBottom:14 }}>
                  <p style={{ color:"#a5b4fc", fontSize:11, marginBottom:6, textAlign:"center" }}>
                    枠内が保存される範囲です
                  </p>
                  <div style={{ width:"100%", position:"relative",
                    paddingBottom: `${100/ratio}%`, maxHeight:240 }}>
                    {/* Full image preview — no clipping */}
                    <div style={{ position:"absolute", inset:0, overflow:"visible",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ position:"relative", width:"100%", height:"100%" }}>
                        <img src={slot.src} alt="" style={{
                          position:"absolute",
                          width: `${slot.zoom * 100}%`,
                          height: `${slot.zoom * 100}%`,
                          objectFit:"cover",
                          top: `${(1 - slot.zoom) * 50 + slot.offsetY}%`,
                          left: `${(1 - slot.zoom) * 50 + slot.offsetX}%`,
                        }} />
                        {/* Crop frame overlay */}
                        <div style={{ position:"absolute", inset:0,
                          boxShadow:"0 0 0 999px rgba(0,0,0,0.55)",
                          border:"2px solid #6366f1",
                          borderRadius:4, pointerEvents:"none", zIndex:2 }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            {[
              ["🔍 ズーム","zoom",100,250, v=>parseFloat(v)/100, v=>Math.round(v*100)],
              ["⬅️➡️ 左右","offsetX",-100,100, v=>parseInt(v), v=>v],
              ["⬆️⬇️ 上下","offsetY",-100,100, v=>parseInt(v), v=>v],
            ].map(([label,key,min,max,parse,disp]) => (
              <div key={key} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ color:"#c7d2fe", fontSize:13, fontWeight:600 }}>{label}</span>
                  <span style={{ color:"#a5b4fc", fontSize:12 }}>{disp(slot[key])}</span>
                </div>
                <input type="range" min={min} max={max} value={disp(slot[key])}
                  onChange={e => handleAdjust(templateId, slotIndex, key, parse(e.target.value))}
                  style={{ width:"100%", height:24, cursor:"pointer" }} />
              </div>
            ))}
            <button onClick={() => { handleRemove(templateId, slotIndex); setControlTarget(null); }}
              style={{ width:"100%", background:"#ef4444",color:"#fff",border:"none",
                borderRadius:8,padding:"10px",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:4 }}>
              🗑 この画像を削除
            </button>
          </div>
        );
      })()}

      {/* Selected banner */}
      {selectedImg && (
        <div style={{ background:"#2563eb", color:"#fff", padding:"8px 14px",
          display:"flex", alignItems:"center", gap:10 }}>
          <img src={selectedImg.src} alt="" style={{ width:32,height:32,objectFit:"cover",borderRadius:4,flexShrink:0 }} />
          <span style={{ fontSize:13, fontWeight:700, flex:1 }}>選択中 → テンプレのスロットをタップ</span>
          <button onClick={e => { e.stopPropagation(); setSelectedImg(null); }}
            style={{ background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",
              borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:700,fontSize:12,flexShrink:0 }}>
            取消
          </button>
        </div>
      )}

      {/* Templates */}
      <div style={{ padding:"14px 14px 6px" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight:700, fontSize:13, color:"#475569", marginBottom:10 }}>🖼 テンプレート</div>
        <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:8 }}>
          {TEMPLATES.map(tmpl => (
            <TemplateCard key={tmpl.id} tmpl={tmpl} slotValues={slots[tmpl.id]}
              selectedImg={selectedImg} onSlotTap={handleSlotTap}
              onOpenControls={setControlTarget} controlTarget={controlTarget}
              onAdjust={handleAdjust} onRemove={handleRemove} onClear={handleClear}
              onSave={saving ? ()=>{} : handleSave} />
          ))}
        </div>
        {saving && <div style={{ textAlign:"center",color:"#6366f1",fontWeight:700,marginTop:4 }}>保存中…</div>}
      </div>

      {/* Tray */}
      <div style={{ padding:"6px 14px 20px" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight:700, fontSize:13, color:"#475569", marginBottom:8 }}>
          📷 写真トレイ
          <span style={{ fontWeight:400, color:"#94a3b8", marginLeft:8, fontSize:12 }}>{images.length}/20枚</span>
        </div>
        <button onClick={() => fileInputRef.current.click()}
          style={{ width:"100%", marginBottom:10, background:"#ede9fe",
            border:"2px dashed #a5b4fc", borderRadius:10, padding:"12px",
            cursor:"pointer", color:"#6366f1", fontWeight:700, fontSize:14 }}>
          📁 写真を追加（複数OK）
        </button>

        {images.length > 0 && (
          <div style={{ background:"#fff", borderRadius:12, padding:12, border:"1px solid #e2e8f0" }}>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {images.map((img, idx) => {
                const isSel = selectedImg?.src === img.src;
                return (
                  <div key={idx} onClick={() => handleTrayTap(img)}
                    style={{ width:72, height:72, borderRadius:8, overflow:"hidden",
                      border: isSel?"3px solid #2563eb":"2px solid #e2e8f0",
                      position:"relative", flexShrink:0, cursor:"pointer",
                      boxShadow: isSel?"0 0 0 3px #93c5fd":"none",
                      transform: isSel?"scale(1.08)":"scale(1)",
                      transition:"transform 0.1s" }}>
                    <img src={img.src} alt="" style={{ width:"100%",height:"100%",objectFit:"cover",display:"block" }} />
                    {isSel && (
                      <div style={{ position:"absolute",inset:0,background:"rgba(37,99,235,0.3)",
                        display:"flex",alignItems:"center",justifyContent:"center" }}>
                        <span style={{ color:"#fff",fontSize:22,fontWeight:800 }}>✓</span>
                      </div>
                    )}
                    <div style={{ position:"absolute",bottom:0,left:0,right:0,
                      background:"rgba(0,0,0,0.4)",color:"#fff",fontSize:9,textAlign:"center",padding:"2px 0" }}>
                      {idx+1}
                    </div>
                    <button onClick={e => {
                        e.stopPropagation();
                        setImages(prev => prev.filter((_,i)=>i!==idx));
                        if (selectedImg?.src === img.src) setSelectedImg(null);
                      }}
                      style={{ position:"absolute",top:2,right:2,background:"rgba(0,0,0,0.6)",
                        color:"#fff",border:"none",borderRadius:"50%",
                        width:18,height:18,fontSize:11,cursor:"pointer",
                        lineHeight:"18px",textAlign:"center",padding:0 }}>×</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" multiple
          style={{ display:"none" }} onChange={e => handleFiles(e.target.files)} />
      </div>

      {/* Instructions */}
      <div style={{ margin:"0 14px 32px", background:"#ede9fe", borderRadius:10, padding:"11px 13px" }}>
        <div style={{ fontWeight:700, color:"#5b21b6", fontSize:13, marginBottom:5 }}>使い方</div>
        <ol style={{ margin:0, paddingLeft:18, fontSize:12, color:"#4c1d95", lineHeight:2.1 }}>
          <li>「写真を追加」で使いたい写真をまとめてアップ</li>
          <li>写真をタップ → 青くなったら選択中</li>
          <li>テンプレートのスロットをタップして配置</li>
          <li>配置済みスロットをタップ → ズーム・位置調整 → 「✓ 完了」で閉じる</li>
          <li>全スロットが埋まったら「💾 保存」でJPGをダウンロード</li>
        </ol>
      </div>
    </div>
  );
}
