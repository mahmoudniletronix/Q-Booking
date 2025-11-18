import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { environment } from '../../../environment/environment';

interface GlobalConfigureItem {
  id: number;
  moduleName: string;
  propertyName: string;
  propertyValue: string;
}

interface GlobalConfigureResponse {
  item: GlobalConfigureItem[];
}

export interface GlobalConfig {
  license?: string;
  orgName?: string;
  orgLogo?: string;

  mainColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;

  backgroundImage?: string;
  backgroundGradient?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GlobalConfigService {
  private http = inject(HttpClient);
  private document = inject(DOCUMENT);

  private _config = signal<GlobalConfig | null>(null);
  config = computed(() => this._config());

  load(): Promise<void> {
    const url = `${environment.baseUrl}/global-configure`;

    return firstValueFrom(
      this.http.get<GlobalConfigureResponse>(url).pipe(
        map((res) => res.item || []),
        map((items) => {
          const get = (name: string, module?: string) =>
            items.find((x) => x.propertyName === name && (!module || x.moduleName === module))
              ?.propertyValue;

          const cfg: GlobalConfig = {
            license: get('License', 'Global') ?? get('License', 'Globals'),
            orgName: get('OrgName', 'Globals'),
            orgLogo: get('OrgLogo', 'Globals'),

            mainColor: get('main_color', 'Themes'),
            secondaryColor: get('secondary_color', 'Themes'),
            backgroundColor: get('background_color', 'Themes'),

            backgroundImage: get('background_image', 'Themes'),
            backgroundGradient: get('background_gradient', 'Themes'),
          };

          return cfg;
        })
      )
    )
      .then((cfg) => {
        this._config.set(cfg);
        this.applyTheme(cfg);
        this.applyBackground(cfg);
      })
      .catch(() => {
        const fallback: GlobalConfig = {
          orgName: 'Reservations',
          orgLogo: 'assets/image/logo.png',
        };

        this._config.set(fallback);
      });
  }

  orgName = computed(() => this.config()?.orgName ?? 'Reservations');
  orgLogo = computed(() => this.config()?.orgLogo ?? 'assets/image/logo.png');

  mainColor = computed(() => this.config()?.mainColor);
  secondaryColor = computed(() => this.config()?.secondaryColor);
  backgroundColor = computed(() => this.config()?.backgroundColor);

  private applyTheme(cfg: GlobalConfig) {
    const root = this.document.documentElement;
    if (!root) return;

    if (cfg.mainColor) root.style.setProperty('--main-color', cfg.mainColor);
    if (cfg.secondaryColor) root.style.setProperty('--secondary-color', cfg.secondaryColor);
    if (cfg.backgroundColor) root.style.setProperty('--background-color', cfg.backgroundColor);
  }

  private applyBackground(cfg: GlobalConfig) {
    const body = this.document.body;

    if (cfg.backgroundGradient) {
      body.style.background = cfg.backgroundGradient;
      body.style.backgroundRepeat = 'no-repeat';
      body.style.backgroundAttachment = 'fixed';
      body.style.backgroundSize = 'cover';
      return;
    }

    if (cfg.backgroundImage) {
      body.style.background = `url(${cfg.backgroundImage})`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundRepeat = 'no-repeat';
      body.style.backgroundAttachment = 'fixed';
      return;
    }

    if (cfg.mainColor && cfg.secondaryColor && cfg.backgroundColor) {
      body.style.background = `linear-gradient(
      0deg,
      ${cfg.mainColor} 0%,
      ${cfg.secondaryColor} 30%,
      ${cfg.backgroundColor} 100%
    )`;
      body.style.backgroundRepeat = 'no-repeat';
      body.style.backgroundAttachment = 'fixed';
      body.style.backgroundSize = 'cover';
      return;
    }

    if (cfg.backgroundColor) {
      body.style.background = cfg.backgroundColor;
    }
  }
}
