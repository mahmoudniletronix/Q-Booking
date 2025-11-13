import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { ScheduleServices, Doctor } from '../../service/schedule/schedule-services';
import {
  TicketReservation,
  TicketReservationDto,
  TicketPrintDto,
  TicketReservationUpdateCommand,
} from '../../service/ticket-reservation/ticket-reservation';
import { GlobalConfigService } from '../../service/config/global-config-service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TicketSearchResultDto } from '../../service/global-search/ticket-search-box';

interface ReservedTicketVm extends TicketReservationDto {
  timeSlot: string;
}

@Component({
  selector: 'app-received-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './received-list.html',
  styleUrls: ['./received-list.css'],
})
export class ReceivedList {
  clinicId!: number;
  doctorId!: number;
  day!: string;
  dayLabel = '';
  ticketId?: number;

  items: ReservedTicketVm[] = [];
  loading = false;

  selectedIds = new Set<number>();
  focusedTicket: ReservedTicketVm | null = null;

  targetDoctorId: number | null = null;
  targetDoctors: Doctor[] = [];

  searchMode = false;
  searchResults: TicketSearchResultDto[] = [];
  searchTermLabel = '';

  selectedSearchTicket: TicketSearchResultDto | null = null;
  searchPopupOpen = false;

  cancelNote = '';
  orgLogo = '';

  // ✅ متغيرات تعديل السلوِت
  editingSlot: boolean = false;
  newSlotValue: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public sch: ScheduleServices,
    private ticketSrv: TicketReservation,
    private globalCfg: GlobalConfigService,
    private http: HttpClient
  ) {
    this.globalCfg.load().catch(() => {});

    // نقرأ كل البارامترات مرة واحدة (مع ticketId)
    this.route.paramMap.subscribe((p) => {
      this.clinicId = +(p.get('clinicId') || 0);
      this.doctorId = +(p.get('doctorId') || 0);
      this.day = p.get('day') || '';

      const tid = p.get('ticketId');
      this.ticketId = tid ? Number(tid) : undefined;

      this.dayLabel = this.buildDayLabel(this.day);
      this.ensureDoctorsLoaded();
      this.loadReserved();
      this.orgLogo = this.globalCfg.orgLogo();
    });
  }

  // ================== Load ==================
  private ensureDoctorsLoaded() {
    const existed = this.sch.getDoctorsByClinic(this.clinicId);
    if (!existed || !existed.length) {
      const d = new Date(this.day || new Date());
      this.sch.loadSchedule(this.clinicId, d.getFullYear(), d.getMonth() + 1);
    }
    this.targetDoctors = this.sch.getDoctorsByClinic(this.clinicId) || [];
  }

  private loadReserved() {
    if (!this.doctorId || !this.day) return;
    const apiDateUs = this.formatUsDate(this.day);
    this.loading = true;

    this.ticketSrv.getByServiceAndDate(this.doctorId, apiDateUs).subscribe({
      next: (list) => {
        const mapped = list.map<ReservedTicketVm>((x) => ({
          ...x,
          timeSlot: x.slotTime?.trim()
            ? this.ensureHms(x.slotTime)
            : this.extractTimeHms(x.reservationDate),
        }));
        mapped.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
        this.items = mapped;
        this.selectedIds.clear();
        this.loading = false;

        // بعد ما البيانات تتحمل نطبق فوكس التذكرة (لو جايين من السيرش)
        this.applyTicketFocus();
      },
      error: () => {
        this.items = [];
        this.selectedIds.clear();
        this.focusedTicket = null;
        this.loading = false;
      },
    });
  }

  private applyTicketFocus() {
    if (this.ticketId && this.items.length) {
      const match = this.items.find((i) => i.id === this.ticketId);
      if (match) {
        this.selectedIds.clear();
        this.selectedIds.add(match.id);
        this.focusedTicket = match;

        setTimeout(() => {
          const el = document.getElementById('ticket-' + match.id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ticket-focus');
            setTimeout(() => el.classList.remove('ticket-focus'), 1500);
          }
        }, 80);

        return;
      }
    }

    if (this.items.length === 1) {
      this.selectedIds.clear();
      this.selectedIds.add(this.items[0].id);
      this.focusedTicket = this.items[0];
    } else {
      this.focusedTicket = null;
      this.selectedIds.clear();
    }
  }

  // ======== ✅ تعديل وقت التذكرة (Update slot) =========
  updateTicketSlot(t: ReservedTicketVm, newSlotHms: string) {
    const normalized = this.ensureHms(newSlotHms);

    if (!normalized) {
      alert('برجاء إدخال وقت صالح');
      return;
    }

    const cmd: TicketReservationUpdateCommand = {
      id: t.id,
      slotTime: normalized,
      patientName: t.patientName,
      phoneNumber: t.phoneNumber,
      serviceId: t.serviceId,
      branchId: t.branchId,
      reservationDateBase: t.reservationDate,
      isCancel: false,
    };

    this.ticketSrv.updateReservation(cmd).subscribe({
      next: () => {
        // نحدّث الـ UI بدون ريلود
        t.timeSlot = normalized;
        (t as any).slotTime = normalized; // لو الـ DTO الأصلي فيه slotTime
      },
      error: (err) => {
        console.error('Update ticket error', err);
        alert('❌ Failed to update ticket.');
      },
    });
  }

  // ======== ✅ دوال التحكم في واجهة تعديل الوقت =========

  startSlotEdit() {
    if (!this.focusedTicket) return;

    // timeSlot غالبًا "HH:mm:ss" → ناخد "HH:mm"
    const base = this.focusedTicket.timeSlot || '';
    this.newSlotValue = base ? base.substring(0, 5) : '';
    this.editingSlot = true;
  }

  applySlotChange() {
    if (!this.focusedTicket) return;
    if (!this.newSlotValue) return;

    // من "HH:mm" إلى "HH:mm:00"
    const hms = this.newSlotValue + ':00';

    this.updateTicketSlot(this.focusedTicket, hms);
    this.editingSlot = false;
    this.newSlotValue = '';
  }

  cancelSlotEdit() {
    this.editingSlot = false;
    this.newSlotValue = '';
  }

  // ================== Helpers ==================
  private buildDayLabel(raw: string): string {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: '2-digit',
      });
    }
    return raw;
  }

  private formatUsDate(dayYmd: string): string {
    const d = new Date(dayYmd);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  private ensureHms(hms: string): string {
    if (!hms) return '';
    const parts = hms.split(':').map((p) => p.trim());
    const hh = parts[0] ?? '00';
    const mm = parts[1] ?? '00';
    const ss = parts[2] ?? '00';
    return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}`;
  }

  private extractTimeHms(raw: string): string {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const ss = d.getSeconds().toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  format12(hms: string): string {
    if (!hms) return '';
    const [hStr, mStr] = hms.split(':');
    let h = parseInt(hStr, 10);
    const m = (mStr || '00').padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  // ================== Selection ==================
  trackById = (_: number, t: ReservedTicketVm) => t.id;

  onTicketClick(t: ReservedTicketVm) {
    if (this.selectedIds.has(t.id)) {
      this.selectedIds.delete(t.id);
    } else {
      this.selectedIds.add(t.id);
    }

    if (this.selectedIds.size === 0) {
      this.focusedTicket = null;
      this.editingSlot = false;
      return;
    }

    if (this.selectedIds.size === 1) {
      const onlyId = Array.from(this.selectedIds)[0];
      this.focusedTicket = this.items.find((i) => i.id === onlyId) || null;
    } else {
      this.focusedTicket = null;
      this.editingSlot = false;
    }
  }

  selectAll() {
    this.selectedIds.clear();
    this.items.forEach((i) => this.selectedIds.add(i.id));
    this.focusedTicket = null;
    this.editingSlot = false;
  }

  clearSelection() {
    this.selectedIds.clear();
    this.focusedTicket = null;
    this.editingSlot = false;
  }

  get allSelected(): boolean {
    return this.items.length > 0 && this.selectedIds.size === this.items.length;
  }

  // ================== Search results (global / local) ==================
  onSearchResults(results: TicketSearchResultDto[]) {
    if (!results || !results.length) {
      this.clearSearchMode();
      return;
    }

    this.searchMode = true;
    this.searchResults = results;
    this.searchTermLabel =
      results[0]?.patientName || results[0]?.serviceName || results[0]?.phoneNumber || '';
  }

  clearSearchMode() {
    this.searchMode = false;
    this.searchResults = [];
    this.searchTermLabel = '';
    this.selectedSearchTicket = null;
    this.searchPopupOpen = false;
  }

  openSearchTicketPopup(t: TicketSearchResultDto) {
    this.selectedSearchTicket = t;
    this.searchPopupOpen = true;
  }

  closeSearchTicketPopup() {
    this.searchPopupOpen = false;
  }

  // ================== Move / Cancel ==================
  canMove(): boolean {
    return (
      this.selectedIds.size > 0 && !!this.targetDoctorId && this.targetDoctorId !== this.doctorId
    );
  }

  moveSelected() {
    if (!this.canMove() || !this.targetDoctorId) return;
    const ids = Array.from(this.selectedIds);
    this.ticketSrv.bulkMove(ids, this.targetDoctorId!).subscribe({
      next: () => {
        const d = new Date(this.day);
        this.sch.loadSchedule(this.clinicId, d.getFullYear(), d.getMonth() + 1);
        this.loadReserved();
      },
      error: (err) => {
        console.error('Move tickets error', err);
        alert('❌ Failed to move selected tickets.');
      },
    });
  }

  onDayChange(newDay: string) {
    if (newDay) {
      this.router.navigate(['/patient/received', this.clinicId, this.doctorId, newDay]);
    }
  }

  canCancel(): boolean {
    return this.selectedIds.size > 0 && !!this.cancelNote.trim();
  }

  cancelSelected() {
    if (!this.canCancel()) return;
    const ids = Array.from(this.selectedIds);
    const note = this.cancelNote.trim();

    this.ticketSrv.bulkCancel(ids, note).subscribe({
      next: () => {
        this.items = this.items.filter((t) => !ids.includes(t.id));
        this.selectedIds.clear();
        this.cancelNote = '';
        this.focusedTicket = null;
      },
      error: (err) => {
        console.error('Cancel tickets error', err);
        alert('❌ Failed to cancel selected tickets.');
      },
    });
  }

  // ================== PRINT helpers ==================
  private async printByReservationId(reservationId: number) {
    try {
      const blob = await this.ticketSrv.printFromReservation(reservationId).toPromise();
      if (!blob) return;

      const contentType = (blob.type || '').toLowerCase();

      if (contentType.includes('pdf')) {
        const url = URL.createObjectURL(blob);
        this.openPreviewWindow(
          'Ticket Preview',
          `<iframe id="pdfFrame" src="${url}" style="border:0;width:100%;height:100vh"></iframe>`,
          { autoPrint: true }
        );
        return;
      }

      let asJson: any = null;
      try {
        const txt = await blob.text();
        const parsed = JSON.parse(txt);
        asJson = parsed?.item ?? parsed;
      } catch {
        asJson = null;
      }
      if (asJson && asJson.number) {
        const inner = this.buildLegacyTicketHtml(asJson as TicketPrintDto);
        this.openPreviewWindow(`#${asJson.number}`, inner, { autoPrint: true });
        return;
      }

      const url = URL.createObjectURL(blob);
      this.openPreviewWindow(
        'Ticket Preview',
        `<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#fff">
            <img src="${url}" style="max-width:100%;max-height:100%" />
          </div>`,
        { autoPrint: true }
      );
    } catch (err) {
      console.error('Print error', err);
      alert('❌ Failed to open print preview.');
    }
  }

  async printTicket(t: ReservedTicketVm) {
    await this.printByReservationId(t.id);
  }

  async printSearchTicket(t: TicketSearchResultDto) {
    await this.printByReservationId(t.id);
  }

  private openPreviewWindow(title: string, bodyInnerHtml: string, opts?: { autoPrint?: boolean }) {
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) return;

    const css = `
    *{box-sizing:border-box}
    html,body{margin:0;font-family:"Tajawal","Segoe UI",Arial;-webkit-font-smoothing:antialiased}
    .toolbar{
      position:fixed;top:0;left:0;right:0;background:#111;color:#fff;
      padding:8px 12px;display:flex;gap:8px;align-items:center;z-index:10
    }
    .toolbar .title{font-weight:700;margin-inline-end:auto}
    .toolbar button{border:0;padding:6px 12px;border-radius:8px;font-weight:700;cursor:pointer}
    .btn-print{background:#22c55e;color:#fff}
    .btn-close{background:#ef4444;color:#fff}

    .content{display:flex;justify-content:center}
    .print-wrap{display:flex;justify-content:center;width:100%}
     .print-page{
      width:80mm; background:#fff;
      page-break-inside:avoid;break-inside:avoid;
     }

    @media print{
      @page { size:80mm auto; margin:0 }   
      .toolbar{display:none}
      html,body{width:80mm}
      .print-page{width:80mm;padding:0}    
      img{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    }
  `;

    const printScript = `
    <script>
      (function(){
        function waitImages(){
          const imgs=[...document.images];
          return Promise.all(imgs.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=i.onerror=r;})));
        }
        async function ready(){ try{await waitImages();}catch{} }
        ${
          opts?.autoPrint === false
            ? ''
            : `if(document.readyState==="complete") ready(); else addEventListener('load',ready,{once:true});`
        }
      })();
    <\/script>
  `;

    w.document.open();
    w.document.write(`
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8"/><title>${title}</title>
        <style>${css}</style>
      </head>
      <body>
        <div class="toolbar">
          <div class="title">${title}</div>
          <button class="btn-print" onclick="print()">Print</button>
          <button class="btn-close" onclick="close()">Close</button>
        </div>
        <div class="content">
          <div class="print-wrap">
            <div class="print-page">
              ${bodyInnerHtml}
            </div>
          </div>
        </div>
        ${printScript}
      </body>
    </html>
  `);
    w.document.close();
  }

  private buildLegacyTicketHtml(dto: TicketPrintDto): string {
    const orgLogo = this.makeAbsoluteUrl(this.globalCfg.orgLogo());

    const doctorName = dto.serviceArabicName || dto.serviceEnglishName || '';

    const clinicName = dto.parentServiceArabicName || dto.parentServiceEnglishName || '';

    const branch = dto.branchNameAr || dto.branchNameEn || dto.branchName || '';

    const wait = dto.waitingCount ?? 0;
    const avgWait = dto.averageWaitingTime;
    const phone = dto.customerInput || '';

    return `
  <style>
    html, body {
      margin: 0;
      padding: 0;
      font-family: "Tajawal","Segoe UI",Arial,sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #000;
      background: #fff;
    }

    .ticket {
      margin: 0 auto;
      padding: 0 0 2mm 0;
      background: #fff;
      page-break-inside: avoid;
      break-inside: avoid;
      text-align: center;
    }

    .logo { margin: 2mm 0 2mm; }
    .logo img {
      display: block;
      margin: 0 auto;
      max-width: 70mm;
      max-height: 55mm;
    }

    .header {
       display: flex;
      justify-content: space-between;
      font-size: 11pt;
      color: #444;
      padding: 0 6mm;
      margin: 1mm 0 4mm;
    }

    .patient {
      font-size: 14pt;
      font-weight: 800;
      line-height: 1.3;
      margin-bottom: 1mm;
    }

    .clinic {
      font-size: 10pt;
      font-weight: 400;
      line-height: 1.3;
      margin-bottom: 1.5mm;
    }

    .num {
      font-size: 27pt;
      font-weight: 700;
      margin: 1mm 0 -5mm;
      letter-spacing: .5pt;
    }

    .info {
      text-align: right;
      width: 90%;
      margin: 0 auto 3mm;
      font-size: 10pt;
      line-height: 1.6;
    }
    .label { font-weight: 700; }
    .value { font-weight: normal; }

    .site {
      margin: 0 auto;
      text-align: center;
      border-top: 1px solid #000;
    }
    .site-border {
      width: 100%;
      height: 1px;
      background: #000;
      margin: 2mm 0 1.5mm 0;
      display: block;
    }
    .site-text {
      font-size: 9pt;
      font-weight: 500;
      color: #000;
      direction: ltr;
      letter-spacing: .3pt;
    }

    @page { size: 80mm auto; margin: 0; }

    @media print {
      html, body { width: 80mm; margin: 0; padding: 0; }
      .ticket    { width: 80mm; margin: 0; padding: 0 0 2mm 0; }
      img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>

  <div class="ticket">
    <div class="logo">
      <img src="${orgLogo}" alt="logo" />
    </div>

    <div class="header">
      <span style="color:#000; margin-right: 20px">${dto.printTime ?? ''}</span>
      <span style="color:#000; margin-left: 20px">${dto.printDate ?? ''}</span>
    </div>

    <div class="clinic">${clinicName}</div>
    <div class="patient">د / ${doctorName} </div>

    <br />
    <div class="num">${dto.number ?? ''}</div>
    <br />
    ${phone ? `<div><span class="value">${phone}</span></div>` : ''}
    <br />
    <div class="info">
      <div>
        <span class="label">الفرع: </span>
        <span class="value">${branch}</span>
      </div>

      <div>
        <span class="label">عملاء منتظرين: </span>
        <span class="value">${wait}</span>
      </div>

      ${
        avgWait != null
          ? `<div><span class="label">متوسط وقت الانتظار: </span> <span class="value">${avgWait} دقيقة</span></div>`
          : ''
      }
    </div>

    <div class="site">
      <div class="site-text">www.Niletronix.com</div>
    </div>
  </div>
  `;
  }

  editTicket(t: ReservedTicketVm) {
    this.router.navigate(['/ticket-reservation/edit', t.id]);
  }

  editSearchTicket(t: TicketSearchResultDto) {
    this.router.navigate(['/ticket-reservation/edit', t.id]);
  }

  private makeAbsoluteUrl(src: string | null | undefined): string {
    if (!src) return '';

    if (/^(https?:)?\/\//i.test(src) || /^(data|blob|file):/i.test(src)) {
      return src;
    }

    const trimmed = src.trim();
    const looksLikeRawBase64 = /^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 100;
    if (looksLikeRawBase64) {
      return `data:image/png;base64,${trimmed}`;
    }

    const origin = window.location.origin.replace(/\/+$/, '');
    const path = String(src).replace(/^\/+/, '');
    return `${origin}/${path}`;
  }

  back() {
    this.router.navigate(['/']);
  }
}
