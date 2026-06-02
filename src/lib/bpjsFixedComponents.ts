import { supabase } from "@/integrations/supabase/client";

export type FixedAllowanceComponents = {
  jabatan: boolean;
  komunikasi: boolean;
  operasional: boolean;
};

export const DEFAULT_FIXED_ALLOWANCE_COMPONENTS: FixedAllowanceComponents = {
  jabatan: true,
  komunikasi: true,
  operasional: true,
};

let _cache: FixedAllowanceComponents | null = null;
let _inflight: Promise<FixedAllowanceComponents> | null = null;

/**
 * Ambil flag komponen tunjangan tetap dari pengaturan BPJS (system_settings.bpjs_config).
 * Komponen dengan flag `false` dianggap "tidak tetap" — tidak menambah DPP BPJS dan
 * harus ditampilkan di grup "Tambahan Penghasilan" pada UI/laporan.
 */
export async function getFixedAllowanceComponents(forceRefresh = false): Promise<FixedAllowanceComponents> {
  if (!forceRefresh && _cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const { data } = await supabase.rpc("get_bpjs_config");
      const fac = (data as any)?.fixed_allowance_components || {};
      const result: FixedAllowanceComponents = {
        jabatan: fac.jabatan !== false,
        komunikasi: fac.komunikasi !== false,
        operasional: fac.operasional !== false,
      };
      _cache = result;
      return result;
    } catch {
      return DEFAULT_FIXED_ALLOWANCE_COMPONENTS;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

export function clearFixedAllowanceComponentsCache() {
  _cache = null;
}
