'use client';

interface RupiahInputProps {
  value: string | number;
  onChange: (raw: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

const displayFormatter = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function toDisplayValue(value: string | number): string {
  if (value === '' || value === null || value === undefined) return '';
  const str = String(value).replace(/,/g, '.');
  const num = parseFloat(str);
  if (isNaN(num)) return '';
  return displayFormatter.format(num);
}

export default function RupiahInput({ value, onChange, placeholder, required, className }: RupiahInputProps) {
  const display = toDisplayValue(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
      .replace(/[^0-9.,]/g, '')
      .replace(/,/g, '.')
      .replace(/(\..*)\./g, '$1');
    onChange(raw);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      className={className}
    />
  );
}
