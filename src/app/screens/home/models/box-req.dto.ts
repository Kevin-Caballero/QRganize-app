export interface BoxReqDto {
  name: string;
  description: string;
  image: string;
  checklistId?: number; // ID de la checklist a asignar (opcional)
}
