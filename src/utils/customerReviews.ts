import { userReviewsByCustomer } from "../data/userReviews"
import type { CustomerProfile, UserReviewSignal } from "../types"

export function userReviewSignalsOf(customer: CustomerProfile): UserReviewSignal[] {
  if (customer.userReviews?.length) return customer.userReviews
  return userReviewsByCustomer[customer.id] ?? []
}

export function verifiedUserReviewSignalsOf(customer: CustomerProfile): UserReviewSignal[] {
  return userReviewSignalsOf(customer).filter((review) => review.status === "verified")
}

export function reviewStatusForPrompt(review: UserReviewSignal): string {
  if (review.status === "verified") return "真实用户评价，作为强约束"
  if (review.status === "identity-only") return "客户主体已确认，作为弱约束和采集提醒"
  return "评价待采集，作为弱约束和采集提醒"
}

export function reviewSummaryForPrompt(customer: CustomerProfile): string {
  const reviews = userReviewSignalsOf(customer)
  if (!reviews.length) return ""
  return reviews.slice(0, 3).map((review) => {
    const praised = review.praised.length ? `好评点：${review.praised.join("、")}` : ""
    const pain = review.painPoints.length ? `差评/痛点：${review.painPoints.join("、")}` : ""
    const sample = review.sampleLabel ? `样本状态：${review.sampleLabel}` : ""
    const caution = review.status === "verified" ? "" : "注意：不得把该项当成真实用户好评/差评，只用于提醒出图时保留可校验空间。"
    return `${review.source}（${reviewStatusForPrompt(review)}，${review.productScope}，可信度${review.confidence}）：${[sample, praised, pain, `辅助出图：${review.designAction}`, caution].filter(Boolean).join("；")}`
  }).join("。")
}
