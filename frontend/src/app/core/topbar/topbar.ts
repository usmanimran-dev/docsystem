import { Component, Input } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbar } from "@angular/material/toolbar";
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [MatIconModule, MatMenuModule, MatButtonModule, MatToolbar],
  templateUrl: './topbar.html',
  styleUrls: ['./topbar.scss'],
})
export class TopbarComponent {
  @Input() collapsed = false;

  constructor(private auth: AuthService) { }

  get userName(): string {
    return this.auth.getUserCategory() === 'ADMIN' ? 'ADMIN' : 'USER';
  }

  logout() {
    this.auth.logout();
  }
}
