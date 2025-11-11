import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderPathService } from '../../service/HeaderPathService/HeaderPath-Service';
import { GlobalConfigService } from '../../service/config/global-config-service';

@Component({
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  private headerPathService = inject(HeaderPathService);
  private globalConfig = inject(GlobalConfigService);

  headerPath = computed(() => this.headerPathService.path());

  orgName = this.globalConfig.orgName;
  orgLogo = this.globalConfig.orgLogo;

  get headerSegments(): string[] {
    const path = this.headerPath() || '';
    return path
      .split('/')
      .map((p) => p.trim())
      .filter((p) => !!p);
  }
}
