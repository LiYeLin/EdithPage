import { useTranslation } from '../i18n/useTranslation'
import { useEffect } from 'react'
import { isExtensionSearch } from '../platform/search'

export type OnboardingStep = 1 | 2 | 3 | 4

type Props = { step: OnboardingStep; onNext: () => void; onSkip: () => void }

const content = [
  ['欢迎使用 Edith', '一站式聚合你的常用工具，让工作与学习更高效。'],
  ['切换搜索引擎', '将鼠标移到搜索引擎图标上，选择你喜欢的引擎。'],
  ['选择你的模板', '点击右上角模板入口，查看当前可用的液态气泡模板。'],
  ['进入编辑模式', '使用模板的编辑入口，即可管理分类与站点；液态气泡支持长按站点进入编辑。'],
] as const

export function OnboardingGuide({ step, onNext, onSkip }: Props) {
  const t = useTranslation()
  useEffect(() => {
    document.body.classList.add('onboarding-active')
    return () => document.body.classList.remove('onboarding-active')
  }, [])
  const [title, description] = step === 2 && isExtensionSearch()
    ? [t("使用默认搜索"), t("默认跟随浏览器的搜索设置，也可通过图标临时切换引擎；新标签页会恢复浏览器默认。")]
    : content[step - 1]
  return <div className={`onboarding-guide onboarding-step-${step}`} role="dialog" aria-modal="true" aria-label={t("首次访问引导")}>
    <div className="onboarding-backdrop" />
    <div className="onboarding-card">
      <div className="onboarding-kicker">{t("快速了解 ·")} {step}/4</div>
      <h2>{t(title)}</h2><p>{t(description)}</p>
      <div className="onboarding-footer">
        <button className="onboarding-skip" type="button" onClick={onSkip}>{t("跳过引导")}</button>
        <div className="onboarding-dots" aria-label={t("第 {0} 步，共四步", step)}>{content.map((_, i) => <span key={i} className={i + 1 === step ? 'is-active' : ''} />)}</div>
        <button className="onboarding-next" type="button" onClick={onNext}>{step === 1 ? t("开始使用") : t("下一步")}</button>
      </div>
    </div>
  </div>
}
