import * as PluralizeModule from 'typescript-pluralize'

// Robustly resolve the class from CJS/ESM modules
const Pluralize: any = (PluralizeModule as any).default || PluralizeModule

// override to fix bugs in original
class PluralizeFix extends Pluralize {
  public interpolate(str: string, args: any[]): string {
    return super.interpolate(str, args)
  }
  public replace(word: string, rule: any[]) {
    return word.replace(rule[0], (match, index) => {
      const result = this.interpolate(rule[1], [match, index])
      if (match === '') {
        return this.restoreCase(word[index - 1], result)
      }

      return this.restoreCase(match, result)
    })
  }
}

export default defineNuxtPlugin((_nuxtApp) => {
  const instance = new PluralizeFix()
  const plural = (word: string) => {
    const replaceWord = instance.replaceWord(
      Pluralize.irregularSingles,
      Pluralize.irregularPlurals,
      Pluralize.pluralRules
    )
    return replaceWord(word)
  }

  return {
    provide: {
      plural
    }
  }
})
