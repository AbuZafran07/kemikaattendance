import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { JABATAN_OPTIONS as DEFAULT_JABATAN, DEPARTMENT_OPTIONS as DEFAULT_DEPT } from "@/lib/employeeOptions";

interface DeptJabatanConfig {
  departments: string[];
  jabatan: string[];
}

export function useDepartmentJabatan() {
  const [departments, setDepartments] = useState<string[]>([...DEFAULT_DEPT]);
  const [jabatanOptions, setJabatanOptions] = useState<string[]>([...DEFAULT_JABATAN]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "department_jabatan_config")
          .maybeSingle();

        if (data?.value) {
          const config = data.value as unknown as DeptJabatanConfig;
          if (config.departments?.length) setDepartments(config.departments);
          if (config.jabatan?.length) setJabatanOptions(config.jabatan);
        }
      } catch (err) {
        console.error("Failed to fetch dept/jabatan config:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  return { departments, jabatanOptions, isLoading };
}
