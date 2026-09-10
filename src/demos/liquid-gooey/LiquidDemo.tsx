import { ArrowDown, ArrowRight, Code2, Droplets, Pause, Play, RotateCcw } from 'lucide-react'
import { Liquid } from 'liquid-gooey'
import { useLiquidDemo } from './useLiquidDemo'
import './liquid-demo.css'
import '../../effects/liquid-material.css'
import { liquidMaterial } from '../../effects/liquidMaterial'

const phases = {
  idle: { index: 0, text: '按住图标，拖向另一颗气泡' },
  pull: { index: 0, text: '表面拉伸 · 液桥正在形成' },
  free: { index: 1, text: '液桥断开 · 源气泡弹性回落' },
  join: { index: 2, text: '表面吸附 · 两颗气泡正在融合' },
  settled: { index: 3, text: '融合完成 · 也可以反向拖动' },
}

export default function LiquidDemo() {
  const {
    stageRef, dropRef, bodyRefs, neckRefs, labelRefs, rippleRefs,
    phase, playing, paused, slow, onPointerDown, onPointerMove, onPointerUp,
    onBubblePointerDown, cancel, reset, play, toggleSlow,
  } = useLiquidDemo()
  const status = phases[phase]
  return (
    <main className="liquid-demo">
      <header className="demo-header">
        <div className="demo-brand"><Droplets size={23} strokeWidth={1.6} /><span>liquid<span className="brand-dot">.</span></span></div>
        <span className="demo-header-note">一个关于表面张力的小实验</span>
        <span className="demo-library">liquid-gooey</span>
      </header>
      <section className="demo-intro">
        <h1>让图标，<span>流动起来。</span></h1>
        <p>从一颗气泡出发，融入另一颗。<br className="mobile-break" />拉伸、分离、再相遇。</p>
      </section>
      <section aria-label="流体拖拽实验" className="experiment">
        <div className="liquid-stage" ref={stageRef} data-phase="idle" data-dock="a">
          <div className="stage-grid" aria-hidden="true" />
          <div className="travel-guide" aria-hidden="true"><span /><ArrowRight size={18} /><ArrowDown size={18} /><span /></div>
          {[0, 1].map((index) => <div key={index} className="body-ripple" ref={(node) => { rippleRefs.current[index] = node }} />)}
          {/* 同一 Liquid 才能跨气泡融合；大半径由库按实时尺寸夹紧，
              避免 observe 在初始零尺寸时缓存百分比圆角，最终变成方块。 */}
          <Liquid
            className="liquid-world"
            {...liquidMaterial}
          >
            {(['a', 'b'] as const).map((id, index) => (
              <Liquid.Item key={id} observe radius={9999}>
                <div className={`reservoir bubble-reflective reservoir-${id}`} ref={(node) => { bodyRefs.current[index] = node }} aria-label={`气泡 ${id.toUpperCase()}`} onPointerDown={(event) => onBubblePointerDown(event, index)}>
                  <span className="reservoir-letter">{id.toUpperCase()}</span>
                  <span className="reservoir-shine" aria-hidden="true" />
                  <span className="reservoir-glint" aria-hidden="true" />
                  <span className="reservoir-rim" aria-hidden="true" />
                  <span className="reservoir-caustic" aria-hidden="true" />
                </div>
              </Liquid.Item>
            ))}
            {[0, 1].flatMap((body) => [0, 1, 2, 3].map((bead) => (
              <Liquid.Item key={`${body}-${bead}`} observe radius={9999}>
                <div className="neck-bead" aria-hidden="true" ref={(node) => { neckRefs.current[body][bead] = node }} />
              </Liquid.Item>
            )))}
            <Liquid.Item observe radius={9999}>
              <button
                ref={dropRef}
                className="liquid-icon"
                aria-label="拖动液体图标；也可按回车播放演示"
                aria-describedby="drag-instruction"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={cancel}
                onLostPointerCapture={(event) => { if (event.buttons !== 0) cancel() }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') cancel()
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); play() }
                }}
              >
                <span className="icon-face"><Code2 size={29} strokeWidth={1.8} /></span>
              </button>
            </Liquid.Item>
          </Liquid>
          {[0, 1].map((index) => <div className="reservoir-caption" ref={(node) => { labelRefs.current[index] = node }} key={index}>
            <span>{index === 0 ? 'A' : 'B'}</span>{index === 0 ? '源气泡' : '接收气泡'}
          </div>)}
        </div>
        <div className="experiment-controls">
          <p className="drag-status" id="drag-instruction" role="status"><span className={`status-dot ${phase !== 'idle' ? 'is-active' : ''}`} />{status.text}</p>
          <div className="control-actions">
            <label className="slow-control"><input type="checkbox" checked={slow} onChange={toggleSlow} /><span className="toggle-track" /><span>慢动作</span></label>
            <span className="control-divider" />
            <button className="reset-control" aria-label="重置实验" title="重置" onClick={reset}><RotateCcw size={17} /></button>
            <button className="play-control" onClick={play}>{playing && !paused ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}<span>{playing ? paused ? '继续演示' : '暂停演示' : '播放演示'}</span></button>
          </div>
        </div>
      </section>
      <footer className="demo-footer">
        <ol className="phase-steps" aria-label="流体运动阶段">
          {['拉伸', '分离', '吸附', '融合'].map((title, index) => <li key={title} className={status.index === index ? 'current' : ''} aria-current={status.index === index ? 'step' : undefined}><span>0{index + 1}</span>{title}{index !== 3 && <span className="step-line" />}</li>)}
        </ol>
        <p>只有流体特效，没有业务逻辑。<span>光标移动，反光随行 · 点击回弹 · 鼠标 / 触屏可拖动</span></p>
      </footer>
    </main>
  )
}
