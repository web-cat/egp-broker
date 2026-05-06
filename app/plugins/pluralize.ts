import * as PluralizeModule from 'typescript-pluralize'

export default defineNuxtPlugin((_nuxtApp) => {
  // Robustly resolve the class from CJS/ESM modules
  const PluralizeClass: any = (PluralizeModule as any).default || PluralizeModule

  if (typeof PluralizeClass !== 'function') {
    console.error(
      '[Pluralize Plugin] Failed to resolve Pluralize constructor. Falling back to identity.'
    )
    return {
      provide: {
        plural: (word: string) => word
      }
    }
  }

  const instance = new PluralizeClass()

  // Override to fix bugs in original without using 'extends'
  instance.replace = function (word: string, rule: any[]) {
    return word.replace(rule[0], (match, index) => {
      // Use index 1 as arguments proxy for interpolate
      const result = this.interpolate(rule[1], [match, index])
      if (match === '') {
        return this.restoreCase(word[index - 1], result)
      }

      return this.restoreCase(match, result)
    })
  }

  const plural = (word: string) => {
    const replaceWord = instance.replaceWord(
      PluralizeClass.irregularSingles,
      PluralizeClass.irregularPlurals,
      PluralizeClass.pluralRules
    )
    return replaceWord(word)
  }

  return {
    provide: {
      plural
    }
  }
})
