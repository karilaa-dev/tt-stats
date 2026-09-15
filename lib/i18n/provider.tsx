import { Select } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon, LanguagesIcon } from "lucide-react"
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  isLocale,
  LOCALE_COOKIE,
  localeNames,
  locales,
  type Locale,
} from "./locale"
import { translate } from "./translate"
const LocaleContext = createContext<{
  locale: Locale
  changeLocale: (locale: Locale) => void
}>({ locale: "en", changeLocale: () => {} })
export function LocaleProvider({
  initialLocale = "en",
  children,
}: {
  initialLocale?: Locale
  children: ReactNode
}) {
  const [locale, setLocale] = useState(initialLocale)
  const value = useMemo(
    () => ({
      locale,
      changeLocale: (next: Locale) => {
        if (!isLocale(next)) return
        document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`
        setLocale(next)
      },
    }),
    [locale]
  )
  useEffect(() => {
    document.documentElement.lang = locale
    const title = document.documentElement.dataset.pageTitle
    if (title) document.title = translate(title, locale)
    const description = document.querySelector('meta[name="description"]')
    description?.setAttribute(
      "content",
      translate("Download analytics for @ttgrab.", locale)
    )
  }, [locale])
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}
export function useTranslation() {
  const { locale, changeLocale } = useContext(LocaleContext)
  const t = useCallback((text: string) => translate(text, locale), [locale])
  return { locale, changeLocale, t }
}
/** Text-only translation leaves elements and database values passed as elements intact. */
export function T({ children }: { children: ReactNode }): ReactNode {
  const { t } = useTranslation()
  const visit = (node: ReactNode): ReactNode =>
    typeof node === "string"
      ? t(node)
      : Array.isArray(node)
        ? node.map(visit)
        : node
  return visit(children)
}
const languageOptions = locales.map((value) => ({
  value,
  label: localeNames[value],
}))
const shortNames: Record<Locale, string> = { en: "EN", ru: "РУ", uk: "УК" }
export function LanguageSelector() {
  const { locale, changeLocale, t } = useTranslation()
  return (
    <Select.Root
      items={languageOptions}
      value={locale}
      onValueChange={(value) => {
        if (isLocale(value)) changeLocale(value)
      }}
    >
      <Select.Trigger
        className="language-trigger"
        aria-label={t("Website language")}
      >
        <LanguagesIcon aria-hidden="true" />
        <Select.Value>
          <span className="language-name" lang={locale}>
            {localeNames[locale]}
          </span>
          <span className="language-short" aria-hidden="true">
            {shortNames[locale]}
          </span>
        </Select.Value>
        <Select.Icon>
          <ChevronDownIcon aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className="language-positioner"
          sideOffset={8}
          align="end"
          alignItemWithTrigger={false}
        >
          <Select.Popup className="language-popup">
            <Select.List>
              {languageOptions.map(({ value, label }) => (
                <Select.Item
                  className="language-option"
                  key={value}
                  value={value}
                >
                  <span className="language-option-code" aria-hidden="true">
                    {shortNames[value]}
                  </span>
                  <Select.ItemText lang={value}>{label}</Select.ItemText>
                  <Select.ItemIndicator className="language-option-check">
                    <CheckIcon aria-hidden="true" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
