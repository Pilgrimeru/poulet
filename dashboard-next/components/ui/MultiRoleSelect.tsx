import { MultiValueSelect } from "./MultiValueSelect";

type RoleOption = {
  id: string;
  name: string;
  position: number;
};

export function MultiRoleSelect({
  roles,
  value,
  onChange,
  placeholder = "Ajouter un rôle",
  emptyText = "Aucun rôle sélectionné.",
}: Readonly<{
  roles: RoleOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}>) {
  const options = [...roles]
    .filter((role) => role.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map((role) => ({
      value: role.id,
      label: `@${role.name}`,
    }));

  return <MultiValueSelect options={options} value={value} onChange={onChange} placeholder={placeholder} emptyText={emptyText} />;
}
