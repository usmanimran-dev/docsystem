import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
  ],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
})
export class SignupComponent {
  name = '';
  email = '';
  password = '';
  message = '';

  /**
   * NOT IMPLEMENTED. This screen creates no account — there is no self-signup
   * endpoint, because users are created by an administrator through
   * Admin > Users > Create User. It previously told the user "Signup
   * successful" and sent them to the login page, where their credentials of
   * course did not work.
   *
   * Either wire this to a real endpoint or take the "Sign up" link off the
   * login screen. Until then it says what actually happens.
   */
  onSignup() {
    this.message = 'Accounts are created by an administrator. Please contact your system administrator for access.';
  }
}
