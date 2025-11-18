import { Component } from '@angular/core';
import { LanguageService } from '../../service/lang/language.service';
import { GlobalConfigService } from '../../service/config/global-config-service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  constructor(
    private languageService: LanguageService,
    private globalConfig: GlobalConfigService
  ) {}

  get year(): number {
    return new Date().getFullYear();
  }

  isAr(): boolean {
    return this.languageService.lang() === 'ar';
  }

  get orgName(): string {
    return this.globalConfig.orgName();
  }
}
