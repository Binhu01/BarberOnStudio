import { getServiceCategories } from "../actions";
import { ServiceForm } from "../_components/service-form";

export default async function NovoServicoPage() {
 const categories = await getServiceCategories();

 return (
 <div className="space-y-6">
 <div>
 <h1 className="font-display text-2xl font-bold text-barber-white">Novo Serviço</h1>
 <p className="mt-1 text-sm text-barber-muted">
 Cadastre um novo serviço no catálogo da barbearia
 </p>
 </div>

 <div className="max-w-2xl rounded-xl border border-barber-border bg-barber-graphite p-6">
 <ServiceForm categories={categories} />
 </div>
 </div>
 );
}