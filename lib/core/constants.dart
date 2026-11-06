const businessName = 'S.A Traders';
const businessAddress = 'Vijayanagaram, Gandhi Street, Medavakkam, Chennai';
const businessPhones = '7904846694 / 9790894776';
const businessFirestorePath = 'sa_traders';

const materialCatalog = <MaterialSpec>[
  MaterialSpec('jackey', 'Jackey', 'jackey_qty', 'jackey_rate', 65),
  MaterialSpec('jackey9', '9 Jackey', 'jackey9_qty', 'jackey9_rate', 100),
  MaterialSpec('sheet', 'Sheet', 'sheet_qty', 'sheet_rate', 35),
  MaterialSpec('half_sheet', 'Half Sheet', 'half_sheet_qty', 'half_sheet_rate', 30),
  MaterialSpec('span', 'Span', 'span_qty', 'span_rate', 100),
  MaterialSpec('inner3m', '3M Inner', 'inner3m_qty', 'inner3m_rate', 60),
];
const woodCatalog = <MaterialSpec>[
  MaterialSpec('wood_12', '12 Ft Wood', 'wood_12', 'wood_12_rate', 18),
  MaterialSpec('wood_9', '9 Ft Wood', 'wood_9', 'wood_9_rate', 18),
  MaterialSpec('wood_6', '6 Ft Wood', 'wood_6', 'wood_6_rate', 15),
  MaterialSpec('runner', 'Runner', 'runner', 'runner_rate', 7),
];

class MaterialSpec {
  const MaterialSpec(this.key, this.label, this.quantityField, this.rateField, this.defaultRate);
  final String key, label, quantityField, rateField;
  final double defaultRate;
}

const storeKeys = <String, String>{
  'bills': 'bill_no',
  'column_box_bills': 'id',
  'customers': 'mobile',
  'customBills': 'bill_no',
  'slips': 'slip_no',
  'challans': 'challan_no',
  'inventory': 'item',
  'settings': 'key',
};
