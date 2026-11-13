export interface MockOffer {
  id: string;
  supplier_id: string;
  title: string;
  description: string;
  status: "ACTIVE" | "INACTIVE" | "DRAFT";
  price: number;
  currency: string;
  updated_at: string;
}

export const MOCK_OFFERS: MockOffer[] = [
  {
    id: "off-101",
    supplier_id: "supp-100",
    title: "5-Axis CNC Milling Center VMC-850",
    description:
      "High-precision vertical machining center for aerospace and automotive parts.",
    status: "ACTIVE",
    price: 89500.0,
    currency: "EUR",
    updated_at: "2026-10-15T09:30:00Z",
  },
  {
    id: "off-102",
    supplier_id: "supp-100",
    title: "Industrial Fiber Laser Cutting Machine 3000W",
    description: "Sheet metal laser cutting system with dual exchange tables.",
    status: "ACTIVE",
    price: 45000.0,
    currency: "EUR",
    updated_at: "2026-10-20T14:15:00Z",
  },
  {
    id: "off-103",
    supplier_id: "supp-100",
    title: "Hydraulic Press Brake 160T/3200",
    description: "CNC electro-hydraulic synchronization bending machine.",
    status: "DRAFT",
    price: 32000.0,
    currency: "EUR",
    updated_at: "2026-11-01T11:00:00Z",
  },
  {
    id: "off-201",
    supplier_id: "supp-200",
    title: "Automated Packaging Conveyor Belt System",
    description: "Modular roller conveyor line with smart sorting sensors.",
    status: "ACTIVE",
    price: 18500.0,
    currency: "EUR",
    updated_at: "2026-11-05T16:45:00Z",
  },
  {
    id: "off-202",
    supplier_id: "supp-200",
    title: "Rotary Screw Air Compressor 15kW",
    description: "Oil-injected stationary industrial rotary screw compressor.",
    status: "ACTIVE",
    price: 8200.0,
    currency: "EUR",
    updated_at: "2026-11-08T08:15:00Z",
  },
];
