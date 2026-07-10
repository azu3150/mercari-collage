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
  { id: "v2",    label: "縦2分割",       slots: makeGrid(2,1) },
  { id: "h2",    label: "横2分割（1:1）", slots: makeGrid(1,2) },
  { id: "h21",   label: "横2分割（2:1）", slots: makeH21() },
  { id: "t3",    label: "上横長＋下2",   slots: makeTShape() },
  { id: "g4",    label: "4分割",         slots: makeGrid(2,2) },
  { id: "l1r2",  label: "左縦長＋右2",  slots: makeL1R2() },
  { id: "invt3", label: "上2＋下横長",  slots: makeInvTShape() },
  { id: "l2r3",  label: "左2＋右3",     slots: makeL2R3() },
  { id: "t2b3",  label: "上2＋下3",     slots: makeT2B3() },
  { id: "h3",    label: "横3分割",       slots: makeGrid(1,3) },
  { id: "v3",    label: "縦3分割",       slots: makeGrid(3,1) },
  { id: "g6",    label: "6分割",         slots: makeGrid(3,2) },
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

      // CSS: top:50%, left:50%, transform:translate(calc(-50%+offsetX%), calc(-50%+offsetY%))
      // % in transform = % of image size
      const isWide = sd.w >= sd.h;
      let dw, dh;
      if (isWide) {
        dw = sd.w * slot.zoom;
        dh = dw / imgRatio;
      } else {
        dh = sd.h * slot.zoom;
        dw = dh * imgRatio;
      }
      // center + offset (% of image size)
      const dx = sd.x + sd.w/2 - dw/2 + (slot.offsetX/100) * dw;
      const dy = sd.y + sd.h/2 - dh/2 + (slot.offsetY/100) * dh;

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
        borderRadius: 3, overflow: "hidden", cursor: "pointer",
        boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {slot ? (
        <>
          {(() => {
            const isWide = slotDef.w >= slotDef.h;
            return (
              <img src={slot.src} alt="" style={{
                position: "absolute",
                width: isWide ? `${slot.zoom * 100}%` : "auto",
                height: isWide ? "auto" : `${slot.zoom * 100}%`,
                maxWidth: "none", maxHeight: "none",
                top: "50%",
                left: "50%",
                transform: `translate(calc(-50% + ${slot.offsetX}%), calc(-50% + ${slot.offsetY}%))`,
                pointerEvents: "none",
              }} />
            );
          })()}
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
      width:"100%", overflow:"visible" }}>
      <div style={{ fontWeight:700, fontSize:11, color:"#334155", textAlign:"center", lineHeight:1.3 }}>
        {tmpl.label}
      </div>
      <div style={{ width:"100%", paddingBottom:"100%", position:"relative" }}>
        <div style={{ position:"absolute", inset:0, background:"#e2e8f0", borderRadius:6, overflow:"hidden" }}>
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


const SYSTEM_PROMPT = `あなたはメルカリ出品のプロです。以下のルールを厳守してください。

【タイトルのルール】
・コーチ（Coach）の商品のみ英語タイトルも出力。それ以外のブランドは日本語タイトルのみ（日本語タイトル内のブランド名のラテン文字表記は可）。
・タイトルは必ず40文字をフル活用する。「40文字以内」ではなく、40文字を使い切ること。
・スペース区切り・左詰めでSEOを意識する。スラッシュ（／）区切りは使わない。
・重要なキーワードほど左に置く。

【キーワード（説明文用）のルール】
毎回、タイトルとセットで説明文用キーワードを出力する。以下を必ず網羅する：
ブランド名（日本語＋英語）／アイテム種別／素材／色／金具・ハードウェア／スタイル・デザイン詳細／状態を表す語／年代（該当すればY2K・ヴィンテージ・90sなど）／性別（該当すれば）。日本語と英語を混ぜて検索の網を最大化する。

【絶対に間違えてはいけない区別】
・Coach Signature ＝ 小さなインターロッキングCのモノグラム柄（小さなCが並ぶ柄）。サテン素材で大きなCが並ぶバッグもSignatureと呼ぶ。
・Coach Op Art ＝ 大きく大胆な、幾何学的に重なり合うCの円柄。
この2つは絶対に混同しない。

【その他のルール】
・ヴィンテージ品・希少品には「希少」「旧タグ」などの希少性ワードをキーワードに入れる。
・型番がわかる高級ブランド品は、型番を入れてSEOと購入者の信頼を高める。

【サイズテンプレート】
必ず以下のフォーマットで出力（数値は画像から推測、不明な項目は〇〇のまま）：
縦 約  〇〇cm
横 約  〇〇cm
マチ 約  〇〇cm
ハンドル 約  〇〇cm
ショルダー 約  〇〇cm

【出力フォーマット】
以下の順番でプレーンテキストのみで出力。マークダウン装飾なし。

メルカリタイトル（日本語40字）
（ここに40文字タイトル）

メルカリタイトル（英語40字）※Coachのみ
（ここに英語タイトル、Coach以外は「対象外」と出力）

メルカリタイトル（日本語65字）
（ここに65文字タイトル）

サイズ
縦 約  〇〇cm
横 約  〇〇cm
マチ 約  〇〇cm
ハンドル 約  〇〇cm
ショルダー 約  〇〇cm

説明文キーワード
（キーワード一覧）`;

function TitleGenerator() {
  const [modelNo, setModelNo] = useState("");
  const [image, setImage] = useState(null); // {base64, mimeType}
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef();

  const handleImage = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => {
      const base64 = e.target.result.split(",")[1];
      setImage({ base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!image) { alert("商品画像をアップロードしてください"); return; }
    setLoading(true);
    setResult("");
    try {
      const userText = modelNo ? `商品画像です。型番: ${modelNo}` : "商品画像です。型番は不明です。";
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: image.mimeType, data: image.base64 } },
              { type: "text", text: userText }
            ]
          }]
        })
      });
      const data = await response.json();
      setResult(data.content?.[0]?.text || "エラーが発生しました");
    } catch(e) {
      setResult("エラー: " + e.message);
    }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ padding:"16px 14px 40px" }}>
      {/* Image upload */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontWeight:700, fontSize:13, color:"#475569", marginBottom:8 }}>📷 商品画像</div>
        <div onClick={() => fileRef.current.click()}
          style={{ border:"2.5px dashed #a5b4fc", borderRadius:12, background:"#fff",
            padding:image ? 8 : "24px 16px", textAlign:"center", cursor:"pointer" }}>
          {image ? (
            <img src={`data:${image.mimeType};base64,${image.base64}`} alt=""
              style={{ maxWidth:"100%", maxHeight:240, borderRadius:8, display:"block", margin:"0 auto" }} />
          ) : (
            <>
              <div style={{ fontSize:32 }}>📁</div>
              <div style={{ color:"#6366f1", fontWeight:700, marginTop:6 }}>タップして商品画像を追加</div>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
          onChange={e => handleImage(e.target.files[0])} />
      </div>

      {/* Model number */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:13, color:"#475569", marginBottom:8 }}>🔢 型番（わからない場合は空欄でOK）</div>
        <input value={modelNo} onChange={e => setModelNo(e.target.value)}
          placeholder="例: F15641、9988 など"
          style={{ width:"100%", padding:"10px 12px", borderRadius:8,
            border:"1.5px solid #cbd5e1", fontSize:14, boxSizing:"border-box" }} />
      </div>

      {/* Generate button */}
      <button onClick={handleGenerate} disabled={loading || !image}
        style={{ width:"100%", background: loading||!image ? "#e2e8f0" : "linear-gradient(90deg,#6366f1,#8b5cf6)",
          color: loading||!image ? "#94a3b8" : "#fff",
          border:"none", borderRadius:10, padding:"14px",
          fontWeight:800, fontSize:15, cursor: loading||!image ? "not-allowed" : "pointer", marginBottom:16 }}>
        {loading ? "✨ 生成中..." : "✨ タイトルを生成する"}
      </button>

      {/* Result */}
      {result && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ fontWeight:700, fontSize:13, color:"#475569" }}>📋 生成結果</div>
            <button onClick={handleCopy}
              style={{ background: copied ? "#10b981" : "#6366f1", color:"#fff",
                border:"none", borderRadius:7, padding:"6px 14px",
                fontWeight:700, fontSize:12, cursor:"pointer" }}>
              {copied ? "✓ コピー済み" : "📋 全部コピー"}
            </button>
          </div>
          <div style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:10,
            padding:"14px", fontSize:13, lineHeight:1.8, whiteSpace:"pre-wrap",
            fontFamily:"monospace", color:"#1e293b" }}>
            {result}
          </div>
        </div>
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
  const [currentTmplIndex, setCurrentTmplIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("collage"); // "collage" | "title"
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
      <div style={{ background:"linear-gradient(90deg,#6366f1,#8b5cf6)", padding:"14px 20px 0", color:"#fff" }}>
        <div style={{ fontWeight:800, fontSize:18 }}>📦 メルカリ出品サポート</div>
        <div style={{ display:"flex", marginTop:12 }}>
          {[["collage","🖼 分割画像"],["title","✍️ タイトル生成"]].map(([tab,label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ flex:1, padding:"8px 0", border:"none", cursor:"pointer", fontSize:13, fontWeight:700,
                background: activeTab===tab ? "#fff" : "transparent",
                color: activeTab===tab ? "#6366f1" : "rgba(255,255,255,0.75)",
                borderRadius: activeTab===tab ? "8px 8px 0 0" : "0",
                transition:"all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>
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
              const slotRatio = sd ? sd.w / sd.h : 1;
              // Preview: image shown freely (no clipping), crop frame overlaid as border
              // Frame fills the preview area at slot aspect ratio
              const frameW = slotRatio >= 1 ? 100 : slotRatio * 100;
              const frameH = slotRatio >= 1 ? (100 / slotRatio) : 100;
              const frameLeft = (100 - frameW) / 2;
              const frameTop = (100 - frameH) / 2;
              return (
                <div style={{ marginBottom:14 }}>
                  <p style={{ color:"#a5b4fc", fontSize:11, marginBottom:6, textAlign:"center" }}>
                    紫の枠内が保存される範囲 — スライダーで位置を合わせてください
                  </p>
                  {/* Outer: fixed height container, NO overflow hidden */}
                  <div style={{ width:"100%", height:280, background:"#111",
                    borderRadius:10, position:"relative", overflow:"visible" }}>
                    {/* Image: full size, freely movable, no clipping */}
                    <img src={slot.src} alt="" style={{
                      position:"absolute",
                      width: `${slot.zoom * frameW}%`,
                      height: `${slot.zoom * frameH}%`,
                      objectFit:"cover",
                      top: `${frameTop + (1 - slot.zoom) * frameH / 2 + slot.offsetY * frameH / 100}%`,
                      left: `${frameLeft + (1 - slot.zoom) * frameW / 2 + slot.offsetX * frameW / 100}%`,
                      maxWidth:"none",
                    }} />
                    {/* Crop frame overlay — just the border, no clipping */}
                    <div style={{
                      position:"absolute",
                      left:`${frameLeft}%`, top:`${frameTop}%`,
                      width:`${frameW}%`, height:`${frameH}%`,
                      border:"3px solid #818cf8",
                      borderRadius:4, pointerEvents:"none",
                      boxShadow:"0 0 0 9999px rgba(0,0,0,0.55)",
                    }} />
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

      {activeTab === "collage" && <>
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

      {/* Templates — swipeable single card */}
      <div style={{ padding:"14px 14px 6px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <button onClick={() => setCurrentTmplIndex(i => Math.max(0, i-1))}
            disabled={currentTmplIndex === 0}
            style={{ background: currentTmplIndex===0?"#e2e8f0":"#6366f1", color: currentTmplIndex===0?"#94a3b8":"#fff",
              border:"none", borderRadius:8, padding:"6px 14px", fontSize:18, cursor: currentTmplIndex===0?"default":"pointer" }}>
            ‹
          </button>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontWeight:700, fontSize:15, color:"#334155" }}>{TEMPLATES[currentTmplIndex].label}</div>
            <div style={{ fontSize:11, color:"#94a3b8" }}>{currentTmplIndex+1} / {TEMPLATES.length}</div>
          </div>
          <button onClick={() => setCurrentTmplIndex(i => Math.min(TEMPLATES.length-1, i+1))}
            disabled={currentTmplIndex === TEMPLATES.length-1}
            style={{ background: currentTmplIndex===TEMPLATES.length-1?"#e2e8f0":"#6366f1", color: currentTmplIndex===TEMPLATES.length-1?"#94a3b8":"#fff",
              border:"none", borderRadius:8, padding:"6px 14px", fontSize:18, cursor: currentTmplIndex===TEMPLATES.length-1?"default":"pointer" }}>
            ›
          </button>
        </div>
        {/* Dots indicator */}
        <div style={{ display:"flex", justifyContent:"center", gap:5, marginBottom:10 }}>
          {TEMPLATES.map((_, i) => (
            <div key={i} onClick={() => setCurrentTmplIndex(i)}
              style={{ width: i===currentTmplIndex?16:7, height:7,
                borderRadius:4, cursor:"pointer", transition:"width 0.2s",
                background: i===currentTmplIndex?"#6366f1":"#cbd5e1" }} />
          ))}
        </div>
        <TemplateCard tmpl={TEMPLATES[currentTmplIndex]} slotValues={slots[TEMPLATES[currentTmplIndex].id]}
          selectedImg={selectedImg} onSlotTap={handleSlotTap}
          onOpenControls={setControlTarget} controlTarget={controlTarget}
          onAdjust={handleAdjust} onRemove={handleRemove} onClear={handleClear}
          onSave={saving ? ()=>{} : handleSave} />
        {saving && <div style={{ textAlign:"center",color:"#6366f1",fontWeight:700,marginTop:8 }}>保存中…</div>}
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
