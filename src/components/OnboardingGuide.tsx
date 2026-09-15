import { useEffect } from 'react'

export type OnboardingStep = 1 | 2 | 3 | 4

type Props = { step: OnboardingStep; onNext: () => void; onSkip: () => void }

const content = [
  ['欢迎使用 Edith', '一站式聚合你的常用工具，让工作与学习更高效。'],
  ['切换搜索引擎', '将鼠标移到搜索引擎图标上，选择你喜欢的引擎。'],
  ['选择你的模板', '点击右上角模板入口，查看当前可用的液态气泡模板。'],
  ['进入编辑模式', '使用模板的编辑入口，即可管理分类与站点；液态气泡支持长按站点进入编辑。'],
] as const

export function OnboardingGuide({ step, onNext, onSkip }: Props) {
  useEffect(() => {
    document.body.classList.add('onboarding-active')
    return () => document.body.classList.remove('onboarding-active')
  }, [])
  const [title, description] = content[step - 1]
  return <div className={`onboarding-guide onboarding-step-${step}`} role="dialog" aria-modal="true" aria-label="首次访问引导">
    <div className="onboarding-backdrop" />
    <div className="onboarding-card">
      <div className="onboarding-kicker">快速了解 · {step}/4</div>
      <h2>{title}</h2><p>{description}</p>
      <div className="onboarding-footer">
        <button className="onboarding-skip" type="button" onClick={onSkip}>跳过引导</button>
        <div className="onboarding-dots" aria-label={`第 ${step} 步，共四步`}>{content.map((_, i) => <span key={i} className={i + 1 === step ? 'is-active' : ''} />)}</div>
        <button className="onboarding-next" type="button" onClick={onNext}>{step === 1 ? '开始使用' : '下一步'}</button>
      </div>
    </div>
  </div>
}
