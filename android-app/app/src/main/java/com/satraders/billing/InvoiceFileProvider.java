package com.satraders.billing;

import androidx.core.content.FileProvider;

/** Grants temporary read access only to exported invoice images. */
public class InvoiceFileProvider extends FileProvider {
    public InvoiceFileProvider() { super(); }
}
