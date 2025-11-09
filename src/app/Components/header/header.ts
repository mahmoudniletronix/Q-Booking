import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderPathService } from '../../service/HeaderPathService/HeaderPath-Service';

@Component({
  selector: 'app-header',
  imports: [RouterOutlet, CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  private header = inject(HeaderPathService);
  headerPath = computed(() => this.header.path());
}
