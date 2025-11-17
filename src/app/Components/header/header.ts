import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderPathService } from '../../service/HeaderPathService/HeaderPath-Service';
import { GlobalConfigService } from '../../service/config/global-config-service';
import { TicketSearchBox } from '../ticket-search-box/ticket-search-box';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, TicketSearchBox],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  headerSegments: string[] = [];

  constructor(private headerPath: HeaderPathService, private globalConfig: GlobalConfigService) {
    effect(() => {
      const full = this.headerPath.path();
      this.headerSegments = full
        ? full
            .split('/')
            .map((p) => p.trim())
            .filter(Boolean)
        : [];
    });
  }

  orgLogo() {
    return this.globalConfig.orgLogo();
  }

  orgName() {
    return this.globalConfig.orgName();
  }

  onPathClick(index: number) {
    const lastIndex = this.headerSegments.length - 1;

    if (index === lastIndex) {
      return;
    }

    const steps = index - lastIndex;

    if (typeof window !== 'undefined' && window.history) {
      window.history.go(steps);
    }
  }
}
