import { Component } from '@angular/core';
import { LanguageService } from '../../service/lang/language.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  constructor(private languageService: LanguageService) {}

  get year(): number {
    return new Date().getFullYear();
  }

  isAr(): boolean {
    return this.languageService.lang() === 'ar';
  }
}
