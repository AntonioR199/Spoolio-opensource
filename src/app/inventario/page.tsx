import { getInventory, getStats } from "@/lib/inventory";
import InventoryView from "@/components/InventoryView";

// Legge sempre lo stato corrente del DB ad ogni richiesta.
export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const [rows, stats] = await Promise.all([getInventory(), getStats()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventario filamenti</h1>
        <p className="text-sm text-muted-foreground">
          I tuoi filamenti: colori, quantità e tipologia a colpo d&apos;occhio.
        </p>
      </div>
      <InventoryView rows={rows} stats={stats} />
    </div>
  );
}
