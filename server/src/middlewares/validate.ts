import { NextFunction, Request, Response } from "express";
import { AppError } from "./errorHandler";

type Validator<T> = (payload: unknown) => T;

export const validate =
  <T>(validator: Validator<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = validator(req.body) as Request["body"];
      next();
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : new AppError(400, "Validation failed")
      );
    }
  };
