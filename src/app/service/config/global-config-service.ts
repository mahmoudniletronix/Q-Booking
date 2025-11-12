import { HttpClient } from '@angular/common/http';
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
}
@Injectable({
  providedIn: 'root',
})
export class GlobalConfigService {
  private http = inject(HttpClient);
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

          const license = get('License', 'Global') ?? get('License', 'Globals');
          const orgName = get('OrgName', 'Globals') ?? 'Q-Booking';
          const orgLogo = get('OrgLogo', 'Globals') ?? 'assets/image/logo.png';

          return { license, orgName, orgLogo } as GlobalConfig;
        })
      )
    )
      .then((cfg) => {
        this._config.set(cfg);
      })
      .catch(() => {
        this._config.set({
          orgName: 'Reservations',
          orgLogo: 'assets/image/logo.png',
        });
      });
  }

  orgName = computed(() => this.config()?.orgName ?? 'Reservations');
  orgLogo = computed(() => this.config()?.orgLogo ?? 'assets/image/logo.png');
}
