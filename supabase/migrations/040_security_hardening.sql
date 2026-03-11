-- Fix 1: Revoke all direct trade function access — trades must go through the API proxy now.
-- Only postgres and service_role should be able to call these.
REVOKE ALL ON FUNCTION execute_trade(uuid, text, text, numeric, numeric, text, text, numeric) FROM authenticated;
REVOKE ALL ON FUNCTION execute_trade(uuid, text, text, numeric, numeric, text, text, numeric) FROM anon;
REVOKE ALL ON FUNCTION place_trade_order(uuid, text, text, numeric, numeric, text, text, numeric) FROM authenticated;
REVOKE ALL ON FUNCTION place_trade_order(uuid, text, text, numeric, numeric, text, text, numeric) FROM anon;
REVOKE ALL ON FUNCTION execute_trade_internal(uuid, uuid, text, text, numeric, numeric, text, text, numeric) FROM authenticated;
REVOKE ALL ON FUNCTION execute_trade_internal(uuid, uuid, text, text, numeric, numeric, text, text, numeric) FROM anon;
REVOKE ALL ON FUNCTION execute_pending_trade_order(uuid, numeric, numeric) FROM authenticated;
REVOKE ALL ON FUNCTION execute_pending_trade_order(uuid, numeric, numeric) FROM anon;
DO $$ BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION execute_trade(uuid, text, text, numeric, numeric, text, text) FROM authenticated';
  EXECUTE 'REVOKE ALL ON FUNCTION execute_trade(uuid, text, text, numeric, numeric, text, text) FROM anon';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Fix 2: Add US market holidays to market_is_open()
CREATE OR REPLACE FUNCTION us_market_holiday(p_date date)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM p_date);
  v_month integer := EXTRACT(MONTH FROM p_date);
  v_day integer := EXTRACT(DAY FROM p_date);
  v_dow integer := EXTRACT(ISODOW FROM p_date); -- 1=Mon, 7=Sun
  v_week integer;
  v_easter date;
  v_observed date;
  -- Easter calculation variables (Anonymous Gregorian algorithm)
  v_a integer;
  v_b integer;
  v_c integer;
  v_d integer;
  v_e integer;
  v_f integer;
  v_g integer;
  v_h integer;
  v_i integer;
  v_k integer;
  v_l integer;
  v_m integer;
  v_em integer;
BEGIN
  -- New Year's Day (Jan 1, observed Mon if Sun, Fri if Sat)
  v_observed := make_date(v_year, 1, 1);
  IF EXTRACT(ISODOW FROM v_observed) = 7 THEN v_observed := v_observed + 1;
  ELSIF EXTRACT(ISODOW FROM v_observed) = 6 THEN v_observed := v_observed - 1;
  END IF;
  IF p_date = v_observed THEN RETURN true; END IF;

  -- MLK Day (3rd Monday of January)
  IF v_month = 1 AND v_dow = 1 THEN
    v_week := (v_day - 1) / 7 + 1;
    IF v_week = 3 THEN RETURN true; END IF;
  END IF;

  -- Presidents' Day (3rd Monday of February)
  IF v_month = 2 AND v_dow = 1 THEN
    v_week := (v_day - 1) / 7 + 1;
    IF v_week = 3 THEN RETURN true; END IF;
  END IF;

  -- Good Friday (2 days before Easter)
  v_a := v_year % 19;
  v_b := v_year / 100;
  v_c := v_year % 100;
  v_d := v_b / 4;
  v_e := v_b % 4;
  v_f := (v_b + 8) / 25;
  v_g := (v_b - v_f + 1) / 3;
  v_h := (19 * v_a + v_b - v_d - v_g + 15) % 30;
  v_i := v_c / 4;
  v_k := v_c % 4;
  v_l := (32 + 2 * v_e + 2 * v_i - v_h - v_k) % 7;
  v_m := (v_a + 11 * v_h + 22 * v_l) / 451;
  v_em := v_h + v_l - 7 * v_m + 114;
  v_easter := make_date(v_year, v_em / 31, v_em % 31 + 1);
  IF p_date = v_easter - interval '2 days' THEN RETURN true; END IF;

  -- Memorial Day (last Monday of May)
  IF v_month = 5 AND v_dow = 1 AND v_day > 24 THEN RETURN true; END IF;

  -- Juneteenth (Jun 19, observed)
  v_observed := make_date(v_year, 6, 19);
  IF EXTRACT(ISODOW FROM v_observed) = 7 THEN v_observed := v_observed + 1;
  ELSIF EXTRACT(ISODOW FROM v_observed) = 6 THEN v_observed := v_observed - 1;
  END IF;
  IF p_date = v_observed THEN RETURN true; END IF;

  -- Independence Day (Jul 4, observed)
  v_observed := make_date(v_year, 7, 4);
  IF EXTRACT(ISODOW FROM v_observed) = 7 THEN v_observed := v_observed + 1;
  ELSIF EXTRACT(ISODOW FROM v_observed) = 6 THEN v_observed := v_observed - 1;
  END IF;
  IF p_date = v_observed THEN RETURN true; END IF;

  -- Labor Day (1st Monday of September)
  IF v_month = 9 AND v_dow = 1 AND v_day <= 7 THEN RETURN true; END IF;

  -- Thanksgiving (4th Thursday of November)
  IF v_month = 11 AND v_dow = 4 THEN
    v_week := (v_day - 1) / 7 + 1;
    IF v_week = 4 THEN RETURN true; END IF;
  END IF;

  -- Christmas (Dec 25, observed)
  v_observed := make_date(v_year, 12, 25);
  IF EXTRACT(ISODOW FROM v_observed) = 7 THEN v_observed := v_observed + 1;
  ELSIF EXTRACT(ISODOW FROM v_observed) = 6 THEN v_observed := v_observed - 1;
  END IF;
  IF p_date = v_observed THEN RETURN true; END IF;

  RETURN false;
END;
$$;

-- Update market_is_open to check holidays
CREATE OR REPLACE FUNCTION market_is_open(p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXTRACT(ISODOW FROM (p_now AT TIME ZONE 'America/New_York')) <= 5
    AND ((p_now AT TIME ZONE 'America/New_York')::time >= TIME '09:30:00')
    AND ((p_now AT TIME ZONE 'America/New_York')::time < TIME '16:00:00')
    AND NOT us_market_holiday((p_now AT TIME ZONE 'America/New_York')::date);
$$;

-- Update next_market_open to skip holidays
CREATE OR REPLACE FUNCTION next_market_open(p_now timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_et timestamp;
  v_day integer;
BEGIN
  v_et := p_now AT TIME ZONE 'America/New_York';
  v_day := EXTRACT(ISODOW FROM v_et);

  -- If today is a weekday, before market open, and not a holiday
  IF v_day <= 5 AND v_et::time < TIME '09:30:00'
     AND NOT us_market_holiday(v_et::date) THEN
    RETURN (date_trunc('day', v_et) + TIME '09:30:00') AT TIME ZONE 'America/New_York';
  END IF;

  -- If market is currently open
  IF v_day <= 5 AND v_et::time >= TIME '09:30:00' AND v_et::time < TIME '16:00:00'
     AND NOT us_market_holiday(v_et::date) THEN
    RETURN p_now;
  END IF;

  -- Move to next day and skip weekends and holidays
  v_et := date_trunc('day', v_et) + interval '1 day';
  WHILE EXTRACT(ISODOW FROM v_et) > 5 OR us_market_holiday(v_et::date) LOOP
    v_et := v_et + interval '1 day';
  END LOOP;

  RETURN (date_trunc('day', v_et) + TIME '09:30:00') AT TIME ZONE 'America/New_York';
END;
$$;
