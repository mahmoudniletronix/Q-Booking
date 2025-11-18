import { Injectable, signal, effect } from '@angular/core';

export type AppLang = 'ar' | 'en';

const LANG_KEY = 'app_lang';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private readonly _lang = signal<AppLang>((localStorage.getItem(LANG_KEY) as AppLang) || 'ar');

  readonly lang = this._lang.asReadonly();

  constructor() {
    this.applyToDocument(this._lang());

    effect(() => {
      const current = this._lang();
      localStorage.setItem(LANG_KEY, current);
      this.applyToDocument(current);
    });
  }

  setLang(lang: AppLang) {
    if (lang === this._lang()) return;
    this._lang.set(lang);
  }

  private applyToDocument(lang: AppLang) {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
}
