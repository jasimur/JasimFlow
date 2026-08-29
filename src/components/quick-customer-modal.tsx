"use client";

import { useTransition, type FormEvent } from "react";
import { saveCustomer } from "@/actions/customers";
import { useToast } from "@/components/toast";
import { Button, Input, Label, Modal, Textarea } from "@/components/ui";
import type { Customer } from "@/lib/types";

export function QuickCustomerModal({
  open,
  businessId,
  onClose,
  onCreated
}: {
  open: boolean;
  businessId: string;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}) {
  const [pending, startTransition] = useTransition();
  const { show } = useToast();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const input = {
      name: String(fd.get("name") ?? ""),
      contact_person: String(fd.get("contact_person") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      billing_address: String(fd.get("billing_address") ?? ""),
      tax_number: String(fd.get("tax_number") ?? ""),
      notes: String(fd.get("notes") ?? "")
    };

    startTransition(async () => {
      const result = await saveCustomer(input);
      if (!result.ok) {
        show(result.error, "error");
        return;
      }

      const now = new Date().toISOString();
      onCreated({
        id: result.id,
        business_id: businessId,
        name: input.name.trim(),
        contact_person: input.contact_person.trim() || null,
        phone: input.phone.trim() || null,
        email: input.email.trim() || null,
        billing_address: input.billing_address.trim() || null,
        tax_number: input.tax_number.trim() || null,
        notes: input.notes.trim() || null,
        created_at: now,
        updated_at: now
      });
      show("Customer created and selected", "success");
      form.reset();
      onClose();
    });
  }

  return (
    <Modal open={open} title="New customer" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <Label>Customer / company name</Label>
          <Input name="name" autoFocus required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Contact person</Label><Input name="contact_person" /></div>
          <div><Label>Tax / VAT number</Label><Input name="tax_number" /></div>
          <div><Label>Email</Label><Input name="email" type="email" /></div>
          <div><Label>Phone</Label><Input name="phone" /></div>
        </div>
        <div><Label>Billing address</Label><Textarea name="billing_address" /></div>
        <div><Label>Notes</Label><Textarea name="notes" /></div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Create customer"}</Button>
        </div>
      </form>
    </Modal>
  );
}
