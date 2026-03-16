
-- Fix overly permissive customers policy
DROP POLICY "Authenticated can manage customers" ON public.customers;
CREATE POLICY "Admins managers can manage customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'seller'));
CREATE POLICY "Admins managers can update customers" ON public.customers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'seller'));
CREATE POLICY "Admins can delete customers" ON public.customers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix overly permissive sale_items insert policy
DROP POLICY "Authenticated can insert sale items" ON public.sale_items;
CREATE POLICY "Authenticated can insert sale items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.sales WHERE id = sale_id AND user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
