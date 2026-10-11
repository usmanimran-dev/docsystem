import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLinkWithHref } from '@angular/router';
import { AuthService } from '../services/auth.service';

interface MenuItem {
  label: string;
  icon?: string;
  route?: string;
  open?: boolean;
  children?: MenuItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLinkWithHref],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss']
})
export class Sidebar {

  @Input() collapsed = false;
  @Input() menuItems: MenuItem[] = [];

  // PageLayoutComponent owns the collapsed flag — it drives the topbar too —
  // so ask for the change rather than writing to our own input.
  @Output() collapsedChange = new EventEmitter<boolean>();

  constructor(private auth: AuthService) { }

  logout() {
    this.auth.logout();
  }

  toggleSidebar() {
    this.collapsedChange.emit(!this.collapsed);
  }

  toggleMenu(item: MenuItem) {
    item.open = !item.open;
  }
}
