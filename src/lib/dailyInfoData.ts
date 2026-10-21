import { supabase } from "./supabase";
import type { DailyInfo } from "../types/workout";

export type StoredDailyInfo = DailyInfo & {
    revision: number;
};

function isObject(
    value: unknown
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

// 年1〜9999の実在日付を確認する。未来の日付も許可する
export function isValidDailyInfoDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);

    if (
        year < 1 ||
        year > 9999 ||
        month < 1 ||
        month > 12 ||
        day < 1
    ) {
        return false;
    }

    const isLeapYear =
        year % 400 === 0 ||
        (year % 4 === 0 && year % 100 !== 0);

    const daysInMonth = [
        31,
        isLeapYear ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];

    return day <= daysInMonth[month - 1];
}

function isValidBodyWeight(
    value: unknown
): value is number | null {
    return (
        value === null ||
        (
            typeof value === "number" &&
            Number.isFinite(value) &&
            value > 0
        )
    );
}

// DBからの戻り値を検証し、画面で使う形式へ変換する
export function parseDailyInfo(
    value: unknown,
    userId: string
): StoredDailyInfo {
    if (
        !isObject(value) ||
        value.user_id !== userId ||
        typeof value.date !== "string" ||
        !isValidDailyInfoDate(value.date) ||
        !isValidBodyWeight(value.body_weight) ||
        typeof value.revision !== "number" ||
        !Number.isInteger(value.revision) ||
        value.revision < 1
    ) {
        throw new Error(
            "取得した日付別体重の形式が正しくありません。"
        );
    }

    return {
        date: value.date,
        bodyWeight: value.body_weight,
        revision: value.revision,
    };
}

// 指定ユーザーの日付別体重を500件ずつ取得する
export async function loadDailyInfos(
    userId: string
): Promise<StoredDailyInfo[]> {
    const dailyInfos: StoredDailyInfo[] = [];
    const seenDates = new Set<string>();
    const pageSize = 500;

    for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
            .from("daily_infos")
            .select("user_id,date,body_weight,revision")
            .eq("user_id", userId)
            .order("date", { ascending: false })
            .range(offset, offset + pageSize - 1);

        if (error) {
            throw new Error(
                `日付別体重の読み込みに失敗しました：${error.message}`
            );
        }

        if (!Array.isArray(data)) {
            throw new Error(
                "日付別体重の取得結果が正しくありません。"
            );
        }

        for (const row of data) {
            const dailyInfo = parseDailyInfo(row, userId);

            if (seenDates.has(dailyInfo.date)) {
                throw new Error(
                    "取得した日付別体重に重複があります。再読み込みしてください。"
                );
            }

            seenDates.add(dailyInfo.date);
            dailyInfos.push(dailyInfo);
        }

        if (data.length < pageSize) {
            return dailyInfos;
        }
    }
}

// expectedRevisionは、未登録の日なら0、登録済みなら取得した更新番号
export async function saveDailyInfo(
    dailyInfo: DailyInfo,
    expectedRevision: number,
    userId: string
): Promise<StoredDailyInfo> {
    if (!isValidDailyInfoDate(dailyInfo.date)) {
        throw new Error("実在する正しい日付を選んでください。");
    }

    if (!isValidBodyWeight(dailyInfo.bodyWeight)) {
        throw new Error(
            "体重は0より大きい有限数値で入力してください。"
        );
    }

    if (
        !Number.isInteger(expectedRevision) ||
        expectedRevision < 0 ||
        expectedRevision > 2147483647
    ) {
        throw new Error("正しい更新番号が必要です。");
    }

    const { data, error } = await supabase.rpc(
        "save_daily_info",
        {
            p_date: dailyInfo.date,
            p_body_weight: dailyInfo.bodyWeight,
            p_expected_revision: expectedRevision,
        }
    );

    if (error) {
        throw new Error(error.message);
    }

    const savedDailyInfo = parseDailyInfo(data, userId);

    if (
        savedDailyInfo.date !== dailyInfo.date ||
        savedDailyInfo.bodyWeight !== dailyInfo.bodyWeight
    ) {
        throw new Error(
            "体重の保存結果が送信内容と一致しません。最新データを確認してください。"
        );
    }

    return savedDailyInfo;
}