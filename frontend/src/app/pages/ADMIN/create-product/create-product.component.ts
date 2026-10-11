import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from '@angular/material/input';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-create-product',
  imports: [ReactiveFormsModule, CommonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule],
  standalone: true,
  templateUrl: './create-product.component.html',
  styleUrl: './create-product.component.scss'
})
export class CreateProductComponent implements OnInit {
  productForm!: FormGroup;

  busy = false;
  resultMessage = '';
  errorMessage = '';

  constructor(private fb: FormBuilder, private apiService: ApiService) { }

  ngOnInit(): void {
    this.productForm = this.fb.group({
      // Was missing entirely before - the template showed "required" and
      // disabled the button on productForm.invalid, but with no validator
      // the form was never actually invalid, so an empty code could submit.
      productcode: ['', Validators.required],
    });
  }

  addProduct(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.busy = true;
    this.resultMessage = '';
    this.errorMessage = '';

    this.apiService.addProduct(this.productForm.value.productcode).subscribe({
      next: () => {
        this.busy = false;
        this.resultMessage = `Product "${this.productForm.value.productcode}" added.`;
        this.productForm.reset();
      },
      error: (err) => {
        this.busy = false;
        this.errorMessage = err?.error?.message ?? err?.message ?? 'Could not add product.';
      }
    });
  }
}
