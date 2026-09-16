/**
 * Supplier form contract — README §1.8 / §8.1.
 *
 * What is protected here is the promise the schema's own docblock makes: the
 * §8.1 data sheet comes back partially filled far more often than not, so only
 * the company name and the country may ever refuse a save. A rule added to any
 * other field would lock a real supplier out of the master data, which is the
 * failure these tests exist to catch.
 *
 * The seed is imported rather than rebuilt for the round trip: "every record we
 * already hold can be opened and saved again" is only an assertion when the
 * records are the real ones.
 */

import { describe, expect, it } from "vitest";

import { CERTIFICATES_BY_SUPPLIER, SUPPLIERS } from "@/lib/mock-data";
import {
  CERTIFICATE_OPTIONS,
  COUNTRY_OPTIONS,
  emptySupplierFormValues,
  supplierFormSchema,
  supplierToFormValues,
  toDateInputValue,
  withCurrentValue,
} from "@/lib/suppliers/supplier-schema";

/** The blank form with one field changed — the shape the component submits. */
function formWith(patch: Partial<ReturnType<typeof emptySupplierFormValues>>) {
  return { ...emptySupplierFormValues(), ...patch };
}

/** The first message zod reported for one field path. */
function messageFor(
  result: ReturnType<typeof supplierFormSchema.safeParse>,
  path: string,
): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join(".") === path)?.message;
}

const VALID = formWith({ companyName: "Hebei Huatong Wires & Cables Group Co., Ltd.", country: "China" });

describe("required fields", () => {
  it("refuses a form with no company name and no country", () => {
    const result = supplierFormSchema.safeParse(emptySupplierFormValues());

    expect(result.success).toBe(false);
    expect(messageFor(result, "companyName")).toBe("Company name is required.");
    expect(messageFor(result, "country")).toBe("Country is required.");
  });

  it("does not accept whitespace as a company name", () => {
    // `optionalText` trims before `min(1)`, so a name of spaces is no name.
    const result = supplierFormSchema.safeParse(formWith({ ...VALID, companyName: "   " }));

    expect(result.success).toBe(false);
    expect(messageFor(result, "companyName")).toBe("Company name is required.");
  });

  it("accepts a country the prototype's select does not list", () => {
    // The select is a vocabulary, not a constraint: the schema must not refuse a
    // supplier outside the seeded four (see `withCurrentValue`).
    expect(supplierFormSchema.safeParse(formWith({ ...VALID, country: "Türkiye" })).success).toBe(
      true,
    );
    expect(COUNTRY_OPTIONS).not.toContain("Türkiye");
  });
});

describe("the rest of the data sheet stays optional", () => {
  it("saves a sheet that carries nothing but the two required fields", () => {
    expect(supplierFormSchema.safeParse(VALID).success).toBe(true);
  });

  it("does not impose a numeric or year format on the sheet's number fields", () => {
    // §8.1 is free text as the supplier writes it — "1984 (as Huatong Cable)",
    // "approx. 3,500", "283,000 m²". A numeric rule here would refuse the real
    // sheet, so its absence is the contract, not an oversight.
    const result = supplierFormSchema.safeParse(
      formWith({
        ...VALID,
        establishedYear: "1984 (as Huatong Cable)",
        employees: "approx. 3,500",
        factorySizeM2: "283,000 m²",
        companyCapital: "CNY 3,800,000,000",
        productionCapacity: "15,000,000 units/year",
      }),
    );

    expect(result.success).toBe(true);
  });

  it("trims what it stores", () => {
    const result = supplierFormSchema.safeParse(
      formWith({ ...VALID, companyName: "  Amos Fluid Technology Co., Ltd  ", city: "  Ningguo " }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.companyName).toBe("Amos Fluid Technology Co., Ltd");
      expect(result.data.city).toBe("Ningguo");
    }
  });
});

describe("the website field", () => {
  it("accepts the bare hosts suppliers actually write, with or without a scheme", () => {
    // `z.url()` would refuse every one of the first three, which are seeded
    // values — that is why the schema carries a pattern of its own.
    for (const value of [
      "htcablewire.com",
      "www.shimgepump.com",
      "www.lingxiao.com.cn",
      "https://example.com",
      "http://example.com/products?id=3",
      "example.com:8443/en",
      "",
    ]) {
      expect(
        supplierFormSchema.safeParse(formWith({ ...VALID, websiteUrl: value })).success,
      ).toBe(true);
    }
  });

  it("refuses something that is not a host at all", () => {
    for (const value of ["not a website", "example", "https://", "www .example.com"]) {
      const result = supplierFormSchema.safeParse(formWith({ ...VALID, websiteUrl: value }));

      expect(result.success).toBe(false);
      expect(messageFor(result, "websiteUrl")).toBe(
        "Enter a website like www.example.com or https://example.com.",
      );
    }
  });
});

describe("the contact card", () => {
  it("accepts a card with no e-mail address", () => {
    const result = supplierFormSchema.safeParse(
      formWith({
        ...VALID,
        contacts: [{ name: "Lola Lu", role: "Sales manager", email: "", phone: "", wechat: "" }],
      }),
    );

    expect(result.success).toBe(true);
  });

  it("refuses a half-typed address, and names the card it is on", () => {
    const result = supplierFormSchema.safeParse(
      formWith({
        ...VALID,
        contacts: [
          { name: "Lola Lu", role: "", email: "lolalu@shimge.com", phone: "", wechat: "" },
          { name: "Second", role: "", email: "second@", phone: "", wechat: "" },
        ],
      }),
    );

    expect(result.success).toBe(false);
    expect(messageFor(result, "contacts.1.email")).toBe(
      "Enter a valid e-mail address, e.g. name@company.com.",
    );
    expect(messageFor(result, "contacts.0.email")).toBeUndefined();
  });
});

describe("every seeded supplier can be opened and saved again", () => {
  it("re-validates all 14 seeded records without a single error", () => {
    const rejected = SUPPLIERS.filter((supplier) => {
      const values = supplierToFormValues(
        supplier,
        CERTIFICATES_BY_SUPPLIER[supplier.id] ?? [],
      );
      return !supplierFormSchema.safeParse(values).success;
    }).map((supplier) => supplier.shortName);

    expect(rejected).toEqual([]);
    expect(SUPPLIERS).toHaveLength(14);
  });

  it("puts the legal name in the sheet's Company name column", () => {
    const supplier = SUPPLIERS.find((candidate) => candidate.id === "shimge");
    if (!supplier) throw new Error("Supplier seed shimge is missing.");

    const values = supplierToFormValues(supplier);

    expect(values.companyName).toBe("Shimge Pump Industry (Zhejiang) Co., Ltd");
    expect(values.country).toBe("China");
    expect(values.contacts[0]).toMatchObject({ name: "Lola Lu", role: "Sales manager" });
  });

  it("opens a supplier with no contacts on a single blank card", () => {
    const supplier = SUPPLIERS.find((candidate) => candidate.id === "huatong");
    if (!supplier) throw new Error("Supplier seed huatong is missing.");

    const values = supplierToFormValues({ ...supplier, contacts: [] });

    expect(values.contacts).toEqual([{ name: "", role: "", email: "", phone: "", wechat: "" }]);
    expect(values.certificates).toHaveLength(1);
    expect(values.certificates[0].name).toBe("");
  });

  it("converts the collected certificate dates into what a date input accepts", () => {
    const supplier = SUPPLIERS.find((candidate) => candidate.id === "huatong");
    if (!supplier) throw new Error("Supplier seed huatong is missing.");

    const values = supplierToFormValues(supplier, CERTIFICATES_BY_SUPPLIER.huatong);

    expect(values.certificates[0]).toMatchObject({
      name: "ISO 9001:2015",
      issueDate: "2024-03-18",
      expirationDate: "2027-03-17",
    });
    // A certificate that never expires keeps an empty field rather than a date
    // the control would silently discard.
    const perpetual = values.certificates.find((row) => row.number === "E-508812");
    expect(perpetual?.issueDate).toBe("2022-02-02");
    expect(perpetual?.expirationDate).toBe("");
  });
});

describe("toDateInputValue", () => {
  it("reads the form a certificate prints and passes yyyy-mm-dd straight through", () => {
    expect(toDateInputValue("18 Mar 2024")).toBe("2024-03-18");
    expect(toDateInputValue("02 Feb 2022")).toBe("2022-02-02");
    expect(toDateInputValue("5 Apr 2024")).toBe("2024-04-05");
    expect(toDateInputValue("16 June 2025")).toBe("2025-06-16");
    expect(toDateInputValue("2024-03-18")).toBe("2024-03-18");
  });

  it("answers blank rather than feeding the control a value it would drop", () => {
    for (const input of ["", "   ", "Mar 2024", "18/03/2024", "18 Foo 2024"]) {
      expect(toDateInputValue(input)).toBe("");
    }
  });
});

describe("withCurrentValue", () => {
  it("grows the select by the stored value the fixed list does not carry", () => {
    // "UL 44 / UL 62" is a real seeded certificate name.
    expect(withCurrentValue(CERTIFICATE_OPTIONS, "UL 44 / UL 62")).toEqual([
      "UL 44 / UL 62",
      ...CERTIFICATE_OPTIONS,
    ]);
  });

  it("does not duplicate a value the list already has, and ignores a blank one", () => {
    expect(withCurrentValue(CERTIFICATE_OPTIONS, "ISO 9001")).toEqual(CERTIFICATE_OPTIONS);
    expect(withCurrentValue(CERTIFICATE_OPTIONS, "  ")).toEqual(CERTIFICATE_OPTIONS);
  });
});
